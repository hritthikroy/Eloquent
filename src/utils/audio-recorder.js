// Cross-platform audio recording utility
// Supports both macOS (sox/rec) and Windows (node-record-lpcm16)

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

class AudioRecorder {
  constructor() {
    this.platform = process.platform;
    this.recordingProcess = null;
    this.isRecording = false;
    this.audioFilePath = null;
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
    
    console.log(`🎤 Using recording binary: ${recBinary}`);

    // Clean recording — no filters (Whisper is noise-robust; filters at 48kHz cause problems)
    this.recordingProcess = spawn(recBinary, [
      '-r', '16000',   // Requested; CoreAudio may use 48000 — Whisper handles both
      '-c', '1',       // Mono
      '-b', '16',      // 16-bit
      '-t', 'wav',
      outputPath
    ]);

    this.recordingProcess.stdout.on('data', () => {}); // WAV data goes to file, ignore stdout

    this.recordingProcess.stderr.on('data', (data) => {
      const str = data.toString();
      // Log useful lines only — suppress per-frame VU meter spam
      if (str.includes('WARN') || str.includes('ERROR') || str.includes('Input File') ||
          str.includes('Sample Rate') || str.includes('Channels') || str.includes('Aborted')) {
        console.log('📊 Sox stderr:', str.trim());
      }

      // Parse VU meter bar for amplitude: e.g. [    ==|==    ] or [   -==|==-   ]
      // This fires every ~130ms per SoX chunk — reliable heartbeat for VAD
      const vuMatch = str.match(/\[([^\]]*)\|([^\]]*)\]/);
      if (vuMatch && this.onAmplitude) {
        const rawBars = vuMatch[1] + vuMatch[2];
        const signalChars = rawBars.replace(/[\s]/g, '');
        let energy = 0;
        for (const ch of signalChars) {
          if (ch === '-' || ch === ':') energy += 1;
          else if (ch === '=') energy += 2;
          else if (ch === '#' || ch === '!') energy += 3;
          else energy += 1;
        }
        // If there is ANY signal activity inside VU meter, guarantee minimum 0.08 amplitude
        const amplitude = signalChars.length > 0 ? Math.max(0.08, Math.min(energy / 12, 1.0)) : 0;
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

    console.log('🛑 Stopping recording...');

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
    if (this.recordingProcess) {
      try {
        this.recordingProcess.kill('SIGTERM');
      } catch (e) {
        try { this.recordingProcess.kill('SIGINT'); } catch (err) {}
      }
      console.log('✅ Unix recording stopped');
      
      // Wait for process to exit with fast 90ms SIGKILL fallback (0ms hang)
      await new Promise((resolve) => {
        if (!this.recordingProcess) return resolve();
        this.recordingProcess.on('close', resolve);
        setTimeout(() => {
          if (this.recordingProcess) {
            try { this.recordingProcess.kill('SIGKILL'); } catch (e) {}
          }
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
}

module.exports = AudioRecorder;
