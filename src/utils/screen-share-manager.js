// Screen Share Manager - Continuous macOS Screen Streaming & Live Vision Perception Engine
const fs = require("fs");
const path = require("path");
const { execSync, exec } = require("child_process");

class ScreenShareManager {
  constructor() {
    this.isActive = false;
    this.interval = null;
    this.framePath = "/tmp/eloquent_screenshare.jpg";
    this.lastContext = {
      appName: "",
      windowTitle: "",
      timestamp: 0,
      frameSizeKB: 0
    };
    this.overlayWindow = null;
    this.isCapturing = false;
  }

  setOverlayWindow(win) {
    this.overlayWindow = win;
  }

  start(overlayWindow = null) {
    if (overlayWindow) this.overlayWindow = overlayWindow;
    if (this.isActive) return true;

    this.isActive = true;
    console.log("🖥️ [Screen Share] Continuous Screen Share activated!");

    // Notify overlay UI
    if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
      try {
        this.overlayWindow.webContents.send("screenshare-status", { active: true });
      } catch (e) {}
    }

    // Capture initial frame immediately
    this.captureFrame();

    // Start 2.5s continuous streaming loop
    this.interval = setInterval(() => {
      this.captureFrame();
    }, 2500);

    return true;
  }

  stop(overlayWindow = null) {
    if (overlayWindow) this.overlayWindow = overlayWindow;
    if (!this.isActive) return false;

    this.isActive = false;
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    console.log("🖥️ [Screen Share] Continuous Screen Share paused.");

    // Notify overlay UI
    if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
      try {
        this.overlayWindow.webContents.send("screenshare-status", { active: false });
      } catch (e) {}
    }

    return true;
  }

  toggle(overlayWindow = null) {
    if (this.isActive) {
      return this.stop(overlayWindow);
    } else {
      return this.start(overlayWindow);
    }
  }

  captureFrame() {
    if (this.isCapturing || !this.isActive) return;
    this.isCapturing = true;

    // Asynchronously capture screen to avoid blocking event loop
    exec(`screencapture -x -C "${this.framePath}" 2>/dev/null && sips -Z 1280 "${this.framePath}" 2>/dev/null`, (err) => {
      this.isCapturing = false;
      if (err) return;

      try {
        let appName = "";
        let winTitle = "";
        try {
          const appOut = execSync(
            `osascript -e 'tell application "System Events" to get name of first application process whose frontmost is true' 2>/dev/null`,
            { timeout: 1000 }
          ).toString().trim();
          if (appOut) appName = appOut;
        } catch (e) {}

        const stats = fs.existsSync(this.framePath) ? fs.statSync(this.framePath) : null;
        this.lastContext = {
          appName: appName || "Active Workspace",
          windowTitle: winTitle,
          timestamp: Date.now(),
          frameSizeKB: stats ? Math.round(stats.size / 1024) : 0
        };

        if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
          try {
            this.overlayWindow.webContents.send("screenshare-frame-updated", this.lastContext);
          } catch (e) {}
        }
      } catch (e) {}
    });
  }

  getVisionContext() {
    return {
      isActive: this.isActive,
      framePath: this.framePath,
      appName: this.lastContext.appName || "Active Workspace",
      windowTitle: this.lastContext.windowTitle || "",
      frameSizeKB: this.lastContext.frameSizeKB || 0,
      timestamp: this.lastContext.timestamp
    };
  }
}

module.exports = new ScreenShareManager();
