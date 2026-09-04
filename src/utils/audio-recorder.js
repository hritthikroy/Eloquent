// Cross-platform audio recording utility
// Supports both macOS (sox/rec) and Windows (node-record-lpcm16)

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

class AudioRecorder {
  constructor(options = {}) {
    this.platform = process.platform;
    this.recordingProcess = null;
    this.isRecording = false;
    this.audioFilePath = null;
    this.bufferSize = options.bufferSize !== undefined ? options.bufferSize : (process.env.ELOQUENT_AUDIO_BUFFER_SIZE || 32);
  }

  /**
   * Find the appropriate recording binary for macOS/Linux
   */
  findRecordingBinary() {
    const possiblePaths = [
      'rec', // System PATH (development)
      '/opt/homebrew/bin/rec', // Homebrew ARM Mac
      '/usr/local/bin/rec', // Homebrew Intel Mac
      '/usr/bin/rec', // Linux
      path.join(process.resourcesPath || '', 'bin', 'rec'), // Bundled in app
      path.join(__dirname, '..', '..', 'assets', 'bin', 'mac', 'rec'), // Dev bundled
    ];
    
    for (const binPath of possiblePaths) {
      try {
        if (binPath === 'rec') {
          // Check if rec is in PATH
          const { execSync } = require('child_process');
          execSync('which rec', { stdio: 'ignore' });
          return 'rec';
        } else if (fs.existsSync(binPath)) {
          return binPath;
        }
      } catch (e) {
        // Continue to next path
      }
    }
    return null;
  }

  /**
   * Start recording audio
   * @param {string} outputPath - Path where the audio file should be saved
   * @returns {Promise<boolean>} - Returns true if recording started successfully
   */
  async startRecording(outputPath) {
    if (this.isRecording) {
      console.warn('⚠️ Recording already in progress');
      return false;
    }

    this.audioFilePath = outputPath;
    this.isRecording = true;

    try {
      if (this.platform === 'win32') {
        // Windows: Use node-record-lpcm16
        return await this.startWindowsRecording(outputPath);
      } else {
        // macOS/Linux: Use sox/rec
        return await this.startUnixRecording(outputPath);
      }
    } catch (error) {
      console.error('❌ Failed to start recording:', error);
      this.isRecording = false;
      throw error;
    }
  }

  /**
   * Start recording on Windows using node-record-lpcm16
   */
  async startWindowsRecording(outputPath) {
    try {
      const record = require('node-record-lpcm16');
      const wav = require('node-wav');
      
      console.log('🎤 Starting Windows recording...');
      
      const audioStream = [];
      
      // Configure recording
      const recording = record.record({
        sampleRate: 16000,
        channels: 1,
        audioType: 'wav',
        recorder: 'sox', // Try sox first (if installed)
        device: null // Use default device
      });

      // Collect audio data
      recording.stream()
        .on('data', (chunk) => {
          audioStream.push(chunk);
        })
        .on('error', (err) => {
          console.error('Recording stream error:', err);
          this.isRecording = false;
        });

      this.recordingProcess = recording;
      console.log('✅ Windows recording started successfully');
      return true;

    } catch (error) {
      console.error('❌ Windows recording failed:', error);
      console.log('💡 Trying fallback method...');
      
      // Fallback: Try using PowerShell for audio recording
      return this.startWindowsRecordingPowerShell(outputPath);
    }
  }

  /**
   * Fallback Windows recording using PowerShell
   */
  async startWindowsRecordingPowerShell(outputPath) {
    console.log('🎤 Starting Windows PowerShell recording...');
    
    // Use SoundRecorder or NAudio through PowerShell
    const psScript = `
    Add-Type -AssemblyName System.Speech
    $rec = New-Object System.Speech.Recognition.SpeechRecognitionEngine
    $rec.SetInputToDefaultAudioDevice()
    `;
    
    // For now, use a simple approach with node-record-lpcm16 without sox
    try {
      const record = require('node-record-lpcm16');
      
      const recording = record.record({
        sampleRate: 16000,
        channels: 1,
        audioType: 'wav'
      });

      this.recordingProcess = recording;
      console.log('✅ Windows PowerShell recording started');
      return true;
      
    } catch (error) {
      console.error('❌ PowerShell recording failed:', error);
      throw new Error('Windows audio recording not available. Please install sox: choco install sox');
    }
  }

  /**
   * Start recording on macOS/Linux using sox/rec
   */
  async startUnixRecording(outputPath) {
    const recBinary = this.findRecordingBinary();
    
    if (!recBinary) {
      throw new Error('Sox/rec not found. Please install: brew install sox (macOS) or sudo apt-get install sox (Linux)');
    }
    
    // 0-buffer instant streaming: minimum hardware threshold 32 bytes (1ms at 16kHz mono)
    const rawBuffer = this.bufferSize !== undefined ? this.bufferSize : (process.env.ELOQUENT_AUDIO_BUFFER_SIZE || 32);
    const bufferBytes = Math.max(32, parseInt(rawBuffer, 10) || 32);

    console.log(`🎤 Using recording binary: ${recBinary} (0-buffer mode: ${bufferBytes} bytes / instant streaming)`);

    // Clean recording with explicit -S progress updates and 0-buffer instant streaming for real-time VAD
    this.recordingProcess = spawn(recBinary, [
      '--buffer', String(bufferBytes), // 0-buffer / 32-byte 1ms instant audio pass-through
      '-S',            // Force progress & VU meter bar output on stderr in non-TTY pipe
      '-r', '16000',   // Requested; CoreAudio may use 48000 — Whisper handles both
      '-c', '1',       // Mono
      '-b', '16',      // 16-bit
      '-t', 'wav',
      outputPath
    ]);

    this.recordingProcess.stdout.on('data', () => {}); // WAV data goes to file, ignore stdout

    this.recordingProcess.stderr.on('data', (data) => {
      const str = data.toString();
      // Log useful lines only — suppress per-frame VU meter spam and hardware sample rate negotiation warnings
      const isHarmlessRateWarn = str.includes("can't set sample rate");
      if (!isHarmlessRateWarn && (str.includes('ERROR') || str.includes('Input File') ||
          str.includes('Sample Rate') || str.includes('Channels') || str.includes('Aborted'))) {
        console.log('📊 Sox stderr:', str.trim());
      }

      // Parse VU meter bar for amplitude: e.g. [    ==|==    ], [    -=|=-    ], or [     -|     ]
      // This fires every ~130ms per SoX chunk — reliable heartbeat for VAD
      const vuMatch = str.match(/\[([^\]]*)\|([^\]]*)\]/);
      if (vuMatch && this.onAmplitude) {
        const rawBars = vuMatch[1] + vuMatch[2];
        const signalChars = rawBars.replace(/[\s]/g, '');
        let voiceBars = 0;
        let peakBars = 0;
        for (const ch of signalChars) {
          if (ch === '-') voiceBars += 0.5; // Natural human speech energy in SoX
          else if (ch === '=') voiceBars += 1.0; // Medium/strong speech energy
          else if (ch === '#' || ch === '!') peakBars += 1.5;
          else voiceBars += 0.5; // Any other non-whitespace active energy indicator
        }
        const totalBars = voiceBars + peakBars;
        let amplitude = 0.0;
        if (totalBars > 0) {
          amplitude = Math.min(totalBars / 4.0, 1.0);
        }
        this.onAmplitude(amplitude);
      }
    });

    this.recordingProcess.on('error', (err) => {
      console.error('❌ Recording process error:', err);
      this.isRecording = false;
    });

    this.recordingProcess.on('exit', (code, signal) => {
      console.log(`Recording process exited with code ${code}, signal ${signal}`);
      this.isRecording = false;
    });

    console.log('✅ Unix recording started successfully');
    return true;
  }

  /**
   * Stop the current recording
   * @returns {Promise<string>} - Returns the path to the recorded audio file
   */
  async stopRecording() {
    if (!this.isRecording) {
      console.warn('⚠️ No recording in progress');
      return null;
    }

    console.log('🛑 Flushing CoreAudio recording buffer...');

    try {
      if (this.platform === 'win32') {
        return await this.stopWindowsRecording();
      } else {
        return await this.stopUnixRecording();
      }
    } catch (error) {
      console.error('❌ Failed to stop recording:', error);
      throw error;
    } finally {
      this.isRecording = false;
      this.recordingProcess = null;
    }
  }

  /**
   * Stop Windows recording
   */
  async stopWindowsRecording() {
    if (this.recordingProcess && this.recordingProcess.stop) {
      this.recordingProcess.stop();
      console.log('✅ Windows recording stopped');
      
      // Give it a moment to write the file
      await new Promise(resolve => setTimeout(resolve, 100));
      
      return this.audioFilePath;
    }
    return null;
  }

  async stopUnixRecording() {
    const proc = this.recordingProcess;
    if (proc) {
      try {
        proc.kill('SIGTERM');
      } catch (e) {
        try { proc.kill('SIGINT'); } catch (err) {}
      }
      console.log('✅ Unix recording stopped');
      
      // Wait for this specific process to exit with fast 90ms SIGKILL fallback
      await new Promise((resolve) => {
        let timer = null;
        const onClose = () => {
          if (timer) clearTimeout(timer);
          resolve();
        };
        proc.once('close', onClose);
        proc.once('exit', onClose);
        timer = setTimeout(() => {
          try {
            proc.kill('SIGKILL');
          } catch (e) {}
          resolve();
        }, 90);
      });
      
      return this.audioFilePath;
    }
    return null;
  }

  /**
   * Check if audio recording is supported on this platform
   */
  static isSupported() {
    const platform = process.platform;
    
    if (platform === 'win32') {
      // Check if node-record-lpcm16 is available
      try {
        require.resolve('node-record-lpcm16');
        return true;
      } catch (e) {
        return false;
      }
    } else {
      // Check if sox/rec is available
      try {
        const { execSync } = require('child_process');
        execSync('which rec', { stdio: 'ignore' });
        return true;
      } catch (e) {
        return false;
      }
    }
  }

  /**
   * Get platform-specific installation instructions
   */
  static getInstallInstructions() {
    const platform = process.platform;
    
    if (platform === 'win32') {
      return 'Install sox for Windows: choco install sox\nOr download from: https://sourceforge.net/projects/sox/';
    } else if (platform === 'darwin') {
      return 'Install sox for macOS: brew install sox';
    } else {
      return 'Install sox for Linux: sudo apt-get install sox (Ubuntu/Debian) or sudo yum install sox (RedHat/CentOS)';
    }
  }

  /**
   * Fast strided tail inspection of live recording WAV buffer (<0.5ms)
   * Reads only the most recent windowBytes of PCM audio to measure instantaneous acoustic energy
   * @param {string} filePath - Target audio file path
   * @param {number} windowBytes - Bytes to scan from the end of the file (default: 3200 = 100ms at 16kHz mono 16-bit)
   * @returns {{ rms: number, peak: number, samples: number }}
   */
  static getTailAudioBufferEnergy(filePath, windowBytes = 3200) {
    let fd = null;
    try {
      if (!filePath || !fs.existsSync(filePath)) return { rms: 0, peak: 0, samples: 0 };
      const stats = fs.statSync(filePath);
      if (stats.size <= 44) return { rms: 0, peak: 0, samples: 0 };

      const availablePcm = stats.size - 44;
      const bytesToRead = Math.min(availablePcm, windowBytes);
      const alignedBytes = bytesToRead - (bytesToRead % 2);
      if (alignedBytes <= 0) return { rms: 0, peak: 0, samples: 0 };

      const offset = stats.size - alignedBytes;
      const buf = Buffer.allocUnsafe(alignedBytes);
      fd = fs.openSync(filePath, 'r');
      fs.readSync(fd, buf, 0, alignedBytes, offset);

      let sumSquares = 0;
      let peak = 0;
      let samples = 0;
      for (let i = 0; i < buf.length - 1; i += 2) {
        const sample = Math.abs(buf.readInt16LE(i));
        sumSquares += sample * sample;
        if (sample > peak) peak = sample;
        samples++;
      }
      const rms = samples > 0 ? Math.sqrt(sumSquares / samples) / 32768.0 : 0;
      return { rms, peak, samples };
    } catch (e) {
      return { rms: 0, peak: 0, samples: 0 };
    } finally {
      if (fd !== null) {
        try { fs.closeSync(fd); } catch (_) {}
      }
    }
  }
}

AudioRecorder.getTailAudioBufferEnergy = AudioRecorder.getTailAudioBufferEnergy;
module.exports = AudioRecorder;
