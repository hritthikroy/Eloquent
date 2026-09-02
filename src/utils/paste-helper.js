// Cross-platform auto-paste utility
// Supports macOS (AppleScript/Accessibility) and Windows (robotjs)

const { exec } = require('child_process');
const { clipboard, systemPreferences } = require('electron');

class PasteHelper {
  constructor() {
    this.platform = process.platform;
  }

  /**
   * Check if auto-paste is available on this platform
   */
  isAutoPasteAvailable() {
    if (this.platform === 'darwin') {
      // macOS: Check accessibility permission
      try {
        return systemPreferences.isTrustedAccessibilityClient(false);
      } catch (error) {
        console.log('⚠️ Could not check accessibility permission:', error.message);
        return false;
      }
    } else if (this.platform === 'win32') {
      // Windows: Check if robotjs is available
      try {
        require.resolve('robotjs');
        return true;
      } catch (e) {
        return false;
      }
    } else {
      // Linux: Check if xdotool is available
      try {
        const { execSync } = require('child_process');
        execSync('which xdotool', { stdio: 'ignore' });
        return true;
      } catch (e) {
        return false;
      }
    }
  }

  /**
   * Paste text at the current cursor position
   * @param {string} text - Text to paste
   * @param {Object} options - Options for pasting
   * @returns {Promise<boolean>} - True if paste was successful
   */
  async pasteText(text, options = {}) {
    const {
      preserveClipboard = false,
      showNotification = true,
      fallbackToClipboard = true
    } = options;

    // Always copy to clipboard first (guaranteed fallback)
    const oldClipboard = preserveClipboard ? clipboard.readText() : null;
    clipboard.writeText(text);
    console.log('✅ Text copied to clipboard');

    // Try platform-specific auto-paste
    try {
      let success = false;

      if (this.platform === 'darwin') {
        success = await this.pasteMacOS();
      } else if (this.platform === 'win32') {
        success = await this.pasteWindows();
      } else {
        success = await this.pasteLinux();
      }

      if (success) {
        console.log('✅ Auto-paste successful');
        
        // Restore clipboard if needed
        if (preserveClipboard && oldClipboard && oldClipboard !== text) {
          setTimeout(() => {
            clipboard.writeText(oldClipboard);
            console.log('✅ Original clipboard restored');
          }, 1000);
        }
        
        return true;
      } else {
        console.log('⚠️ Auto-paste failed, text available in clipboard');
        return false;
      }
    } catch (error) {
      console.error('❌ Auto-paste error:', error.message);
      return false;
    }
  }

  /**
   * Paste on macOS using AppleScript
   */
  async pasteMacOS() {
    console.log('🎯 Attempting macOS auto-paste...');
    
    // Trigger prompt if permission not yet recorded
    try {
      if (!systemPreferences.isTrustedAccessibilityClient(false)) {
        systemPreferences.isTrustedAccessibilityClient(true);
      }
    } catch (error) {
      // Ignore check errors and proceed to osascript
    }

    // Use AppleScript with Cmd+V
    const pasteScript = `tell application "System Events" to keystroke "v" using command down`;
    
    return new Promise((resolve) => {
      setTimeout(() => {
        exec(`osascript -e '${pasteScript}'`, (error) => {
          if (error) {
            console.log('⚠️ AppleScript paste failed:', error.message);
            
            // Try cliclick as backup
            exec('cliclick kd:cmd t:v ku:cmd', (cliclickError) => {
              if (cliclickError) {
                console.log('⚠️ cliclick also failed:', cliclickError.message);
                resolve(false);
              } else {
                console.log('✅ Auto-paste successful (cliclick)');
                resolve(true);
              }
            });
          } else {
            console.log('✅ Auto-paste successful (AppleScript)');
            resolve(true);
          }
        });
      }, 100); // Small delay to ensure focus is on target app
    });
  }

  /**
   * Paste on Windows using robotjs
   */
  async pasteWindows() {
    console.log('🎯 Attempting Windows auto-paste...');
    
    try {
      const robot = require('robotjs');
      
      // Small delay to ensure focus
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Press Ctrl+V
      robot.keyTap('v', 'control');
      
      console.log('✅ Windows auto-paste successful');
      return true;
      
    } catch (error) {
      console.error('❌ Windows auto-paste failed:', error.message);
      
      // Fallback: Try using PowerShell SendKeys
      return this.pasteWindowsPowerShell();
    }
  }

  /**
   * Fallback Windows paste using PowerShell SendKeys
   */
  async pasteWindowsPowerShell() {
    console.log('🎯 Trying Windows PowerShell paste...');
    
    const psScript = `
      Add-Type -AssemblyName System.Windows.Forms
      [System.Windows.Forms.SendKeys]::SendWait("^v")
    `;
    
    return new Promise((resolve) => {
      exec(`powershell -Command "${psScript}"`, (error) => {
        if (error) {
          console.log('⚠️ PowerShell paste failed:', error.message);
          resolve(false);
        } else {
          console.log('✅ PowerShell paste successful');
          resolve(true);
        }
      });
    });
  }

  /**
   * Paste on Linux using xdotool
   */
  async pasteLinux() {
    console.log('🎯 Attempting Linux auto-paste...');
    
    return new Promise((resolve) => {
      // Try xdotool first
      exec('xdotool key ctrl+v', (error) => {
        if (error) {
          console.log('⚠️ xdotool paste failed:', error.message);
          
          // Fallback to xte
          exec('xte "keydown Control_L" "key v" "keyup Control_L"', (xteError) => {
            if (xteError) {
              console.log('⚠️ xte also failed:', xteError.message);
              resolve(false);
            } else {
              console.log('✅ Linux auto-paste successful (xte)');
              resolve(true);
            }
          });
        } else {
          console.log('✅ Linux auto-paste successful (xdotool)');
          resolve(true);
        }
      });
    });
  }

  /**
   * Prompt user to enable auto-paste (platform-specific)
   */
  promptEnableAutoPaste() {
    if (this.platform === 'darwin') {
      return this.promptMacOSAccessibility();
    } else if (this.platform === 'win32') {
      return this.promptWindowsSetup();
    } else {
      return this.promptLinuxSetup();
    }
  }

  /**
   * Prompt macOS accessibility permission
   */
  promptMacOSAccessibility() {
    const { dialog } = require('electron');
    
    const result = dialog.showMessageBoxSync({
      type: 'info',
      title: '🎯 Enable Auto-Paste Feature',
      message: 'Make Eloquent paste text automatically at your cursor?',
      detail: '🎯 AUTO-PASTE BENEFITS:\n• Text appears instantly where you\'re typing\n• No need to press Cmd+V\n• Seamless workflow\n\n🔧 SETUP STEPS:\n1. Click "Open Settings" below\n2. Find "Electron" or "Eloquent" in the list\n3. Toggle it ON ✅\n4. Restart Eloquent\n\n📋 BACKUP: Text is always copied to clipboard regardless',
      buttons: ['Open Settings', 'Maybe Later', 'Keep Clipboard Only'],
      defaultId: 0,
      cancelId: 1
    });

    if (result === 0) {
      exec('open "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility"');
    }

    return result;
  }

  /**
   * Prompt Windows setup
   */
  promptWindowsSetup() {
    const { dialog } = require('electron');
    
    const result = dialog.showMessageBoxSync({
      type: 'info',
      title: '🎯 Auto-Paste Feature',
      message: 'Eloquent can automatically paste transcribed text at your cursor position.',
      detail: '🎯 AUTO-PASTE BENEFITS:\n• Text appears instantly where you\'re typing\n• No need to press Ctrl+V\n• Seamless workflow\n\nWindows auto-paste is built-in and ready to use!\n\n📋 BACKUP: Text is always copied to clipboard',
      buttons: ['Got it!', 'Use Clipboard Only'],
      defaultId: 0,
      cancelId: 1
    });

    return result;
  }

  /**
   * Prompt Linux setup
   */
  promptLinuxSetup() {
    const { dialog } = require('electron');
    
    const result = dialog.showMessageBoxSync({
      type: 'info',
      title: '🎯 Enable Auto-Paste Feature',
      message: 'Auto-paste requires xdotool or xte',
      detail: 'Install xdotool:\nsudo apt-get install xdotool\n\nOr install xte:\nsudo apt-get install xautomation\n\nThen restart Eloquent.',
      buttons: ['OK', 'Use Clipboard Only'],
      defaultId: 0,
      cancelId: 1
    });

    return result;
  }

  /**
   * Get platform-specific setup instructions
   */
  static getSetupInstructions() {
    const platform = process.platform;
    
    if (platform === 'darwin') {
      return 'Enable Accessibility: System Settings > Privacy & Security > Accessibility > Enable Eloquent';
    } else if (platform === 'win32') {
      return 'Windows auto-paste is built-in and ready to use!';
    } else {
      return 'Install xdotool: sudo apt-get install xdotool';
    }
  }
}

module.exports = PasteHelper;
