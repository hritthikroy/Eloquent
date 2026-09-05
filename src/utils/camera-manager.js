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
    this.posture = 'sitting';
    this.elevationRatio = 0.5;
    this.gaze = 'focused';
    this.isUserBlinking = false;
    this.lastUserBlinkTime = 0;
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
      this.isUserBlinking = !!data.isBlinking;
      if (this.isUserBlinking) {
        this.lastUserBlinkTime = Date.now();
      }
      if (data.posture) this.posture = data.posture;
      if (data.elevationRatio !== undefined) this.elevationRatio = data.elevationRatio;
      if (data.gaze) this.gaze = data.gaze;

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
    this.isActive = true;
    if (this.workerWindow && !this.workerWindow.isDestroyed()) {
      try {
        this.workerWindow.webContents.send("start-camera");
      } catch (e) {}
      return true;
    }

    try {
      const electron = require("electron");
      const BrowserWindowClass = electron.BrowserWindow || (electron.default && electron.default.BrowserWindow);
      if (!BrowserWindowClass) {
        return true;
      }

      if (process.platform === 'darwin') {
        const sp = electron.systemPreferences || (electron.default && electron.default.systemPreferences);
        if (sp && typeof sp.askForMediaAccess === 'function') {
          sp.askForMediaAccess('camera').catch(() => {});
        }
      }

      this.workerWindow = new BrowserWindowClass({
        width: 160,
        height: 120,
        show: false, // 100% offscreen background worker
        skipTaskbar: true,
        webPreferences: {
          nodeIntegration: true,
          contextIsolation: false,
          backgroundThrottling: false
        }
      });

      const workerPath = path.join(__dirname, "../ui/camera-worker.html");
      this.workerWindow.loadFile(workerPath);
      this.workerWindow.webContents.once("did-finish-load", () => {
        if (this.isActive && this.workerWindow && !this.workerWindow.isDestroyed()) {
          this.workerWindow.webContents.send("start-camera");
        }
      });
      console.log("👁️ [Ocular Eyes] Camera visual perception activated");
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
      try {
        this.workerWindow.webContents.send("stop-camera");
      } catch (e) {}
      try {
        // HARD TERMINATION: Destroy offscreen worker window to immediately release macOS AVFoundation hardware camera lock
        this.workerWindow.destroy();
      } catch (e) {}
      this.workerWindow = null;
      console.log("👁️ [Ocular Eyes] Visual perception hard-stopped & camera hardware released");
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
    const postureDesc = this.posture === 'standing' ? ' (Standing / Active)' : ' (Seated at desk)';
    const gazeDesc = this.gaze === 'focused' ? ', visual focus locked on screen' : ', glancing naturally';
    const status = this.userPresent
      ? (this.isAttentive ? `Hritthik is at his workstation${postureDesc}${gazeDesc}.` : `Hritthik is at his desk${postureDesc}, taking a momentary breather.`)
      : "Hritthik is momentarily away from the desk.";
    const lipStr = this.isLipsMoving ? " [User is actively speaking]" : "";
    return `[OCULAR VISUAL PERCEPTION]: ${status}${lipStr} (Real-time visual telemetry active for rapid learning and understanding)`;
  }

  async captureFaceSnapshot() {
    if (!this.isActive || !this.workerWindow || this.workerWindow.isDestroyed()) {
      this.start();
    }
    return new Promise((resolve, reject) => {
      this.pendingSnapshotPromise = { resolve, reject };
      const sendCapture = () => {
        if (this.workerWindow && !this.workerWindow.isDestroyed()) {
          this.workerWindow.webContents.send("capture-snapshot");
        } else {
          reject(new Error("Camera window unavailable"));
        }
      };

      if (this.workerWindow && this.workerWindow.webContents.isLoading()) {
        this.workerWindow.webContents.once("did-finish-load", () => {
          setTimeout(sendCapture, 300);
        });
      } else {
        setTimeout(sendCapture, 100);
      }

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
