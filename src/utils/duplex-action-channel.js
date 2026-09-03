/**
 * Three-Channel Full-Duplex Action Channel (DuplexSLA Standard, Zhang et al. 2026)
 * Executes asynchronous tasks in the background while spoken dialogue continues uninterrupted.
 */
const { spawn } = require('child_process');

class DuplexActionChannel {
  constructor() {
    this.activeActions = new Map();
  }

  /**
   * Dispatch an asynchronous background action
   * @param {string} actionId - Unique identifier
   * @param {string} command - Binary to execute
   * @param {Array<string>} args - Arguments
   * @param {Function} onComplete - Callback with { actionId, exitCode, output, error }
   */
  dispatchAction(actionId, command, args = [], onComplete = null) {
    console.log(`⚡ [DuplexSLA] Dispatching background action: ${actionId} (${command} ${args.join(' ')})`);

    const proc = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      this.activeActions.delete(actionId);
      console.log(`✅ [DuplexSLA] Action "${actionId}" completed with exit code ${code}`);
      if (onComplete) {
        onComplete({
          actionId,
          exitCode: code,
          output: stdout.trim(),
          error: stderr.trim()
        });
      }
    });

    proc.on('error', (err) => {
      this.activeActions.delete(actionId);
      console.error(`❌ [DuplexSLA] Action "${actionId}" error:`, err.message);
      if (onComplete) {
        onComplete({
          actionId,
          exitCode: -1,
          output: stdout.trim(),
          error: err.message
        });
      }
    });

    this.activeActions.set(actionId, { process: proc, startTime: Date.now() });
    return true;
  }

  getActiveCount() {
    return this.activeActions.size;
  }
}

module.exports = DuplexActionChannel;
