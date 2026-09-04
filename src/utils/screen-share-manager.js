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
    this.consecutiveErrors = 0;
  }

  setOverlayWindow(win) {
    this.overlayWindow = win;
  }

  start(overlayWindow = null) {
    if (overlayWindow) this.overlayWindow = overlayWindow;
    if (this.isActive) return true;

    this.isActive = true;
    this.consecutiveErrors = 0;
    console.log("🖥️ [Screen Share] Continuous Screen Share activated!");

    // Notify overlay UI
    if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
      try {
        this.overlayWindow.webContents.send("screenshare-status", { active: true });
      } catch (e) {}
    }

    // Capture initial frame immediately
    this.captureFrame();

    // Ultra-low CPU idle background heartbeat (7s) - only active when user toggles screen share
    this.interval = setInterval(() => {
      this.captureFrame();
    }, 7000);

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

    // Asynchronously capture screen with fallback if cursor capture flag (-C) is prohibited
    exec(`screencapture -x -C "${this.framePath}" 2>/dev/null && sips -Z 1280 "${this.framePath}" 2>/dev/null`, (err) => {
      if (err) {
        // Fallback: try capturing without cursor flag
        exec(`screencapture -x "${this.framePath}" 2>/dev/null && sips -Z 1280 "${this.framePath}" 2>/dev/null`, (err2) => {
          this.isCapturing = false;
          if (err2) {
            this.consecutiveErrors++;
            if (this.consecutiveErrors === 1) {
              console.warn('⚠️ [Screen Share] Display capture unavailable (macOS Screen Recording permission may be required for Electron in System Settings).');
            } else if (this.consecutiveErrors >= 3) {
              console.warn('⏸️ [Screen Share] Pausing continuous background screen capture.');
              this.stop();
            }
            return;
          }
          this.consecutiveErrors = 0;
          this._processCapturedFrame();
        });
        return;
      }

      this.isCapturing = false;
      this.consecutiveErrors = 0;
      this._processCapturedFrame();
    });
  }

  _processCapturedFrame() {
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
  }

  captureInstantFrame(sync = false) {
    if (sync) {
      try {
        try {
          execSync(`screencapture -x -C "${this.framePath}" 2>/dev/null && sips -Z 1280 "${this.framePath}" 2>/dev/null`, { timeout: 2500 });
        } catch (e1) {
          execSync(`screencapture -x "${this.framePath}" 2>/dev/null && sips -Z 1280 "${this.framePath}" 2>/dev/null`, { timeout: 2500 });
        }
        let appName = "";
        try {
          appName = execSync(
            `osascript -e 'tell application "System Events" to get name of first application process whose frontmost is true' 2>/dev/null`,
            { timeout: 1000 }
          ).toString().trim();
        } catch (e) {}
        const stats = fs.existsSync(this.framePath) ? fs.statSync(this.framePath) : null;
        this.lastContext = {
          appName: appName || "Active Workspace",
          windowTitle: "",
          timestamp: Date.now(),
          frameSizeKB: stats ? Math.round(stats.size / 1024) : 0
        };
        return this.framePath;
      } catch (e) {
        return this.framePath;
      }
    }

    if (this.isCapturing) return this.framePath;
    this.isCapturing = true;

    // Fast non-blocking capture and resize to 1280px optimized (with -x fallback)
    exec(`screencapture -x -C "${this.framePath}" 2>/dev/null && sips -Z 1280 "${this.framePath}" 2>/dev/null`, (err) => {
      if (err) {
        exec(`screencapture -x "${this.framePath}" 2>/dev/null && sips -Z 1280 "${this.framePath}" 2>/dev/null`, (err2) => {
          this.isCapturing = false;
          if (err2) return;
          this._processCapturedFrame();
        });
        return;
      }
      this.isCapturing = false;
      this._processCapturedFrame();
    });
    return this.framePath;
  }

  getVisionContext() {
    const hasFrame = fs.existsSync(this.framePath);
    return {
      isActive: this.isActive || hasFrame,
      hasFrame: hasFrame,
      framePath: this.framePath,
      appName: this.lastContext.appName || "Active Workspace",
      windowTitle: this.lastContext.windowTitle || "",
      frameSizeKB: this.lastContext.frameSizeKB || 0,
      timestamp: this.lastContext.timestamp
    };
  }
}

module.exports = new ScreenShareManager();
