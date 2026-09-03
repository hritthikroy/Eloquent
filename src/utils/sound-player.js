// Cross-platform sound player utility
// Supports macOS (afplay), Windows (PowerShell), and Linux (aplay)

const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

class SoundPlayer {
  constructor() {
    this.platform = process.platform;
    this.sounds = {
      start: null,
      success: null,
      error: null,
      cancel: null,
      notification: null
    };
    
    this.initializeSounds();
  }

  /**
   * Initialize platform-specific sound paths
   */
  initializeSounds() {
    if (this.platform === 'darwin') {
      // macOS system sounds
      this.sounds = {
        start: '/System/Library/Sounds/Tink.aiff',
        success: '/System/Library/Sounds/Glass.aiff',
        error: '/System/Library/Sounds/Basso.aiff',
        cancel: '/System/Library/Sounds/Funk.aiff',
        notification: '/System/Library/Sounds/Ping.aiff'
      };
    } else if (this.platform === 'win32') {
      // Windows system sounds (using system event sounds)
      this.sounds = {
        start: 'SystemAsterisk',
        success: 'SystemNotification',
        error: 'SystemHand',
        cancel: 'SystemExclamation',
        notification: 'SystemNotification'
      };
    } else {
      // Linux - try to use freedesktop sound theme
      const soundThemePath = '/usr/share/sounds/freedesktop/stereo/';
      this.sounds = {
        start: path.join(soundThemePath, 'bell.oga'),
        success: path.join(soundThemePath, 'complete.oga'),
        error: path.join(soundThemePath, 'dialog-error.oga'),
        cancel: path.join(soundThemePath, 'window-close.oga'),
        notification: path.join(soundThemePath, 'message.oga')
      };
    }
  }

  /**
   * Play a sound by type
   * @param {string} type - Type of sound: start, success, error, cancel, notification
   * @param {number} volume - Volume (0.0 to 1.0), defaults to 0.7
   */
  play(type = 'notification', volume = 0.7) {
    // Validate type
    if (!this.sounds[type]) {
      console.warn(`⚠️ Unknown sound type: ${type}`);
      type = 'notification';
    }

    // Adjust volume based on sound type for better UX
    if (type === 'success') {
      volume = 0.6; // Slightly softer for success
    } else if (type === 'error') {
      volume = 0.8; // Slightly louder for errors
    }

    const soundFile = this.sounds[type];

    try {
      if (this.platform === 'darwin') {
        this.playMacOS(soundFile, volume);
      } else if (this.platform === 'win32') {
        this.playWindows(soundFile);
      } else {
        this.playLinux(soundFile, volume);
      }
    } catch (error) {
      console.error(`❌ Sound playback error (${type}):`, error.message);
    }
  }

  /**
   * Play sound on macOS using afplay
   */
  playMacOS(soundFile, volume) {
    if (!fs.existsSync(soundFile)) {
      return;
    }

    const { execFile } = require('child_process');
    execFile('afplay', [soundFile, '-v', String(volume)], (error) => {
      // Ignore SIGTERM/SIGKILL if audio was gracefully stopped
      if (error && !error.killed && error.signal !== 'SIGTERM') {
        // silent recovery
      }
    });
  }

  /**
   * Play sound on Windows using PowerShell
   */
  playWindows(soundType) {
    // Use Windows system sounds via PowerShell
    const psScript = `
      [System.Media.SystemSounds]::${soundType}.Play()
    `;
    
    exec(`powershell -Command "${psScript}"`, (error) => {
      if (error) {
        console.error(`❌ Windows sound playback error:`, error.message);
        // Fallback to beep
        this.playWindowsBeep();
      }
    });
  }

  /**
   * Fallback: Play Windows console beep
   */
  playWindowsBeep() {
    const psScript = `[console]::beep(800, 200)`;
    exec(`powershell -Command "${psScript}"`, (error) => {
      if (error) {
        console.error(`❌ Windows beep error:`, error.message);
      }
    });
  }

  /**
   * Play sound on Linux using aplay or paplay
   */
  playLinux(soundFile, volume) {
    if (!fs.existsSync(soundFile)) {
      console.warn(`⚠️ Sound file not found: ${soundFile}`);
      return;
    }

    // Try aplay first (ALSA)
    exec(`aplay "${soundFile}" 2>/dev/null`, (error) => {
      if (error) {
        // Fallback to paplay (PulseAudio)
        exec(`paplay "${soundFile}"`, (paError) => {
          if (paError) {
            console.error(`❌ Linux sound playback error:`, paError.message);
          }
        });
      }
    });
  }

  /**
   * Play a custom sound file
   * @param {string} filePath - Path to the sound file
   * @param {number} volume - Volume (0.0 to 1.0)
   */
  playCustom(filePath, volume = 0.7) {
    if (!fs.existsSync(filePath)) {
      console.warn(`⚠️ Custom sound file not found: ${filePath}`);
      return;
    }

    try {
      if (this.platform === 'darwin') {
        exec(`afplay "${filePath}" -v ${volume}`);
      } else if (this.platform === 'win32') {
        // Use Windows Media Player for custom files
        const psScript = `
          $player = New-Object System.Media.SoundPlayer
          $player.SoundLocation = "${filePath.replace(/\\/g, '\\\\')}"
          $player.Play()
        `;
        exec(`powershell -Command "${psScript}"`);
      } else {
        exec(`aplay "${filePath}" 2>/dev/null || paplay "${filePath}"`);
      }
    } catch (error) {
      console.error('❌ Custom sound playback error:', error.message);
    }
  }

  /**
   * Check if sound playback is supported
   */
  static isSupported() {
    const platform = process.platform;
    
    if (platform === 'darwin') {
      return true; // macOS always has afplay
    } else if (platform === 'win32') {
      return true; // Windows always has PowerShell
    } else {
      // Linux: check for aplay or paplay
      try {
        const { execSync } = require('child_process');
        execSync('which aplay', { stdio: 'ignore' });
        return true;
      } catch (e) {
        try {
          execSync('which paplay', { stdio: 'ignore' });
          return true;
        } catch (e2) {
          return false;
        }
      }
    }
  }
}

module.exports = SoundPlayer;
