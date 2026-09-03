// Camera Vision, Lip-Sync VAD & Affective Presence Engine for Eloquent
const { BrowserWindow, ipcMain } = require("electron");
const fs = require("fs");
const path = require("path");

class CameraManager {
  constructor() {
    this.workerWindow = null;
    this.isActive = false;
    this.isLipsMoving = false;
    this.lastLipMotionTime = 0;
    this.lipMotionEnergy = 0.0;
    this.snapshotPath = "/tmp/eloquent_face.jpg";
    this.pendingSnapshotPromise = null;

    this._setupIpc();
  }

  _setupIpc() {
    const electron = require("electron");
    const ipc = electron && (electron.ipcMain || (electron.default && electron.default.ipcMain));
    if (!ipc || typeof ipc.on !== "function") return;

    ipc.on("camera-status-changed", (event, status) => {
      this.isActive = !!status.active;
      console.log(`👁️ [Camera Manager] Camera active state: ${this.isActive}`);
    });

    ipcMain.on("camera-telemetry", (event, data) => {
      this.lipMotionEnergy = data.lipMotionEnergy || 0.0;
      this.isLipsMoving = !!data.isLipsMoving;
      if (this.isLipsMoving) {
        this.lastLipMotionTime = Date.now();
      }
    });

    ipcMain.on("camera-snapshot-captured", (event, res) => {
      if (this.pendingSnapshotPromise) {
        if (res.dataUrl) {
          try {
            const base64Data = res.dataUrl.replace(/^data:image\/\w+;base64,/, "");
            fs.writeFileSync(this.snapshotPath, Buffer.from(base64Data, "base64"));
            this.pendingSnapshotPromise.resolve(this.snapshotPath);
          } catch (err) {
            this.pendingSnapshotPromise.reject(err);
          }
        } else {
          this.pendingSnapshotPromise.reject(new Error(res.error || "Snapshot capture failed"));
        }
        this.pendingSnapshotPromise = null;
      }
    });
  }

  start() {
    if (this.workerWindow && !this.workerWindow.isDestroyed()) {
      this.workerWindow.webContents.send("start-camera");
      return true;
    }

    try {
      const electron = require("electron");
      const BrowserWindowClass = electron.BrowserWindow || (electron.default && electron.default.BrowserWindow);
      if (!BrowserWindowClass) {
        // Mock fallback if running in standalone Node.js CLI
        this.isActive = true;
        return true;
      }

      this.workerWindow = new BrowserWindowClass({
        width: 160,
        height: 120,
        show: false, // 100% offscreen background worker
        webPreferences: {
          nodeIntegration: true,
          contextIsolation: false
        }
      });

      const workerPath = path.join(__dirname, "../ui/camera-worker.html");
      this.workerWindow.loadFile(workerPath);
      console.log("👁️ [Camera Manager] Background Camera Worker initiated");
      return true;
    } catch (err) {
      console.error("❌ Failed to initiate Camera Manager:", err.message);
      return false;
    }
  }

  stop() {
    this.isActive = false;
    this.isLipsMoving = false;
    if (this.workerWindow && !this.workerWindow.isDestroyed()) {
      this.workerWindow.webContents.send("stop-camera");
      console.log("👁️ [Camera Manager] Camera stream paused");
    }
    return true;
  }

  /**
   * Audio-Visual Voice Activity Detection Check
   * Returns true if lips are actively moving or were moving within the last 40ms
   */
  isLipMovementDetected() {
    if (!this.isActive) return false;
    const elapsedSinceMotion = Date.now() - this.lastLipMotionTime;
    return this.isLipsMoving || (elapsedSinceMotion < 45);
  }

  /**
   * Capture on-demand snapshot of user face for Gemini Vision
   */
  async captureFaceSnapshot() {
    if (!this.isActive || !this.workerWindow || this.workerWindow.isDestroyed()) {
      throw new Error("Camera is not active. Turn on camera first.");
    }

    return new Promise((resolve, reject) => {
      this.pendingSnapshotPromise = { resolve, reject };
      this.workerWindow.webContents.send("capture-snapshot");
      setTimeout(() => {
        if (this.pendingSnapshotPromise) {
          this.pendingSnapshotPromise.reject(new Error("Camera snapshot timed out after 3000ms"));
          this.pendingSnapshotPromise = null;
        }
      }, 3000);
    });
  }
}

const cameraManager = new CameraManager();
module.exports = cameraManager;
