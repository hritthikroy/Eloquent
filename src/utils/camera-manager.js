// Camera Vision, Lip-Sync VAD & Affective Presence Engine for Eloquent
const fs = require("fs");
const path = require("path");

class CameraManager {
  constructor() {
    this.workerWindow = null;
    this.isActive = false;
    this.isLipsMoving = false;
    this.lastLipMotionTime = 0;
    this.lipMotionEnergy = 0.0;
    this.userPresent = true;
    this.isAttentive = true;
    this.lastVisualPerceptionTime = 0;
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
      console.log(`👁️ [Ocular Eyes] Camera active as squad eyes: ${this.isActive}`);
    });

    ipc.on("camera-telemetry", (event, data) => {
      this.lipMotionEnergy = data.lipMotionEnergy || 0.0;
      this.isLipsMoving = !!data.isLipsMoving;
      this.userPresent = data.userPresent !== undefined ? !!data.userPresent : true;
      this.isAttentive = data.isAttentive !== undefined ? !!data.isAttentive : true;
      if (this.isLipsMoving) {
        this.lastLipMotionTime = Date.now();
      }
      this.lastVisualPerceptionTime = Date.now();
    });

    ipc.on("camera-snapshot-captured", (event, res) => {
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
      this.isActive = true;
      return true;
    }

    try {
      const electron = require("electron");
      const BrowserWindowClass = electron.BrowserWindow || (electron.default && electron.default.BrowserWindow);
      if (!BrowserWindowClass) {
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
      this.isActive = true;
      console.log("👁️ [Ocular Eyes] Squad visual ocular presence activated 24/7!");
      return true;
    } catch (err) {
      console.error("❌ Failed to initiate Ocular Eyes:", err.message);
      return false;
    }
  }

  stop() {
    this.isActive = false;
    this.isLipsMoving = false;
    if (this.workerWindow && !this.workerWindow.isDestroyed()) {
      this.workerWindow.webContents.send("stop-camera");
      console.log("👁️ [Ocular Eyes] Visual perception paused");
    }
    return true;
  }

  isLipMovementDetected() {
    if (!this.isActive) return false;
    const elapsedSinceMotion = Date.now() - this.lastLipMotionTime;
    return this.isLipsMoving || (elapsedSinceMotion < 45);
  }

  getVisualContext() {
    if (!this.isActive) return "Camera perception is currently paused.";
    const status = this.userPresent
      ? (this.isAttentive ? "Hritthik is at his desk, eyes focused forward on screen/code." : "Hritthik is at his desk, moving or conversing naturally.")
      : "Hritthik is momentarily away from the desk.";
    return `[OCULAR VISUAL PERCEPTION]: ${status} (Visual telemetry synced real-time)`;
  }

  async captureFaceSnapshot() {
    if (!this.isActive) {
      this.start();
    }
    if (!this.workerWindow || this.workerWindow.isDestroyed()) {
      throw new Error("Camera window unavailable");
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
