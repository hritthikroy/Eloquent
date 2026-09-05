/**
 * Eloquent Renderer - Clipboard Bridge Utility
 * 
 * Thin wrapper for the renderer process to invoke 'clipboard:copy-bengali-fix'
 * via the secure IPC bridge. Handles error catching, native clipboard fallback,
 * and user-friendly toast notification triggers.
 */

const { BENGALI_FIX_PROMPT } = require('../../shared/constants/prompts');

/**
 * Triggers a UI toast notification if a toast handler is available in the global scope.
 * 
 * @param {string} message - Toast display message
 * @param {'success'|'error'|'info'} type - Notification style
 */
function showToast(message, type = 'info') {
  if (typeof window !== 'undefined') {
    if (typeof window.showToast === 'function') {
      window.showToast(message, type);
      return;
    }
    if (window.toast && typeof window.toast[type] === 'function') {
      window.toast[type](message);
      return;
    }
  }
  // Console fallback
  if (type === 'error') {
    console.error(`[Toast Error] ${message}`);
  } else {
    console.log(`[Toast ${type}] ${message}`);
  }
}

/**
 * Copies the Bengali fixing prompt to the OS clipboard.
 * 
 * @param {string} [customPrompt] - Optional prompt override
 * @param {Object} [options]
 * @param {Function} [options.onToast] - Custom toast notification callback
 * @returns {Promise<{ success: boolean, prompt: string, error?: string }>}
 */
async function copyBengaliFixPrompt(customPrompt = BENGALI_FIX_PROMPT, options = {}) {
  const toastFn = typeof options.onToast === 'function' ? options.onToast : showToast;
  const targetText = typeof customPrompt === 'string' && customPrompt.trim()
    ? customPrompt
    : BENGALI_FIX_PROMPT;

  // 1. Primary: Electron IPC Bridge via window.electron or window.clipboardAPI
  if (typeof window !== 'undefined') {
    try {
      let result = null;

      if (window.electron?.ipcRenderer?.invoke) {
        result = await window.electron.ipcRenderer.invoke('clipboard:copy-bengali-fix', targetText);
      } else if (window.clipboardAPI?.copyBengaliFix) {
        result = await window.clipboardAPI.copyBengaliFix(targetText);
      } else if (window.ipcRenderer?.invoke) {
        result = await window.ipcRenderer.invoke('clipboard:copy-bengali-fix', targetText);
      }

      if (result && result.success) {
        toastFn('Bengali fix prompt copied to clipboard!', 'success');
        return { success: true, prompt: targetText };
      }
    } catch (ipcErr) {
      console.warn('⚠️ [ClipboardBridge] IPC copy failed, attempting navigator.clipboard fallback:', ipcErr.message);
    }

    // 2. Fallback: Browser Navigator Clipboard API
    if (navigator?.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(targetText);
        toastFn('Bengali fix prompt copied to clipboard (browser fallback)!', 'success');
        return { success: true, prompt: targetText };
      } catch (navErr) {
        const msg = `Failed to copy prompt to clipboard: ${navErr.message}`;
        toastFn(msg, 'error');
        return { success: false, prompt: targetText, error: navErr.message };
      }
    }
  }

  // 3. Headless / Node Environment (Service invocation)
  try {
    const { ClipboardService } = require('../../main/services/clipboardService');
    const success = await ClipboardService.copyBengaliFixPrompt(targetText);
    if (success) {
      toastFn('Bengali fix prompt copied to clipboard (service)!', 'success');
      return { success: true, prompt: targetText };
    }
    throw new Error('ClipboardService write failed');
  } catch (err) {
    const errorMsg = `Clipboard write failed: ${err.message}`;
    toastFn(errorMsg, 'error');
    return { success: false, prompt: targetText, error: err.message };
  }
}

module.exports = {
  copyBengaliFixPrompt,
  showToast,
  BENGALI_FIX_PROMPT
};

// ES Module export
if (typeof exports !== 'undefined') {
  exports.default = {
    copyBengaliFixPrompt,
    showToast,
    BENGALI_FIX_PROMPT
  };
}
