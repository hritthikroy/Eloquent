/**
 * Shared Memory Audio Ring Buffer IPC Bridge
 * 
 * Provides an ultra-low-latency interface for the Electron main process
 * to directly map, read, and write raw PCM audio frames from/to the Go audio backend
 * without JSON serialization overhead.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const {
  MAGIC_BYTES,
  PROTOCOL_VERSION,
  DEFAULT_SHM_PATH_POSIX,
  HEADER_SIZE,
  DEFAULT_SLOT_COUNT,
  DEFAULT_SLOT_SIZE,
  SLOT_HEADER_SIZE,
  MAX_PAYLOAD_SIZE,
  TOTAL_SEGMENT_SIZE,
  GLOBAL_HEADER_OFFSETS,
  SLOT_HEADER_OFFSETS,
  STATE_FLAGS,
  FRAME_FLAGS,
  AUDIO_RING_CHANNELS
} = require('../../shared/constants');

class SharedMemoryAudioBridge {
  /**
   * @param {Object} options
   * @param {string} [options.path] - Custom shared memory backing file path
   * @param {number} [options.slotCount] - Number of slots (must be power of two)
   * @param {number} [options.slotSize] - Size of each slot in bytes
   * @param {boolean} [options.isCreator] - Whether this instance creates/initializes the segment
   * @param {boolean} [options.inMemory] - In-memory buffer mode (no filesystem, useful for tests)
   */
  constructor(options = {}) {
    this.slotCount = options.slotCount || DEFAULT_SLOT_COUNT;
    this.slotSize = options.slotSize || DEFAULT_SLOT_SIZE;
    this.mask = BigInt(this.slotCount - 1);
    this.headerSize = HEADER_SIZE;
    this.totalSize = this.headerSize + (this.slotCount * this.slotSize);
    this.isCreator = options.isCreator || false;
    this.inMemory = options.inMemory || false;
    this.pid = process.pid;

    if (this.inMemory) {
      this.shmPath = null;
      this.fd = null;
      this.rawBuffer = Buffer.alloc(this.totalSize);
    } else {
      this.shmPath = options.path || (
        process.platform === 'win32'
          ? path.join(os.tmpdir(), 'eloquent_audio_shm.bin')
          : DEFAULT_SHM_PATH_POSIX
      );
      this.fd = null;
      this.rawBuffer = Buffer.alloc(this.totalSize);
    }

    this.headerBuffer = Buffer.alloc(this.headerSize);
    this.slotBuffer = Buffer.alloc(this.slotSize);
    this.initialized = false;
  }

  /**
   * Initialize or attach to the shared memory segment.
   */
  init() {
    if (this.initialized) return true;

    if (this.inMemory) {
      if (this.isCreator) {
        this._initializeHeaderInMemory();
      } else {
        this._validateHeaderInMemory();
      }
      this.initialized = true;
      return true;
    }

    // Ensure directory exists
    const dir = path.dirname(this.shmPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Open backing file
    const fileFlags = fs.existsSync(this.shmPath) ? 'r+' : 'w+';
    this.fd = fs.openSync(this.shmPath, fileFlags, 0o666);

    // Verify file size and truncate if necessary
    const stats = fs.fstatSync(this.fd);
    if (stats.size < this.totalSize) {
      fs.ftruncateSync(this.fd, this.totalSize);
    }

    if (this.isCreator || stats.size === 0) {
      this._initializeHeaderOnFile();
    } else {
      this._validateHeaderOnFile();
    }

    this.initialized = true;
    return true;
  }

  _initializeHeaderInMemory() {
    this.rawBuffer.fill(0, 0, this.headerSize);
    this.rawBuffer.writeUInt32LE(MAGIC_BYTES, GLOBAL_HEADER_OFFSETS.MAGIC);
    this.rawBuffer.writeUInt16LE(PROTOCOL_VERSION, GLOBAL_HEADER_OFFSETS.VERSION);
    this.rawBuffer.writeUInt16LE(this.headerSize, GLOBAL_HEADER_OFFSETS.HEADER_SIZE);
    this.rawBuffer.writeBigUInt64LE(0n, GLOBAL_HEADER_OFFSETS.WRITE_INDEX);
    this.rawBuffer.writeBigUInt64LE(0n, GLOBAL_HEADER_OFFSETS.READ_INDEX);
    this.rawBuffer.writeUInt32LE(this.slotCount, GLOBAL_HEADER_OFFSETS.SLOT_COUNT);
    this.rawBuffer.writeUInt32LE(this.slotSize, GLOBAL_HEADER_OFFSETS.SLOT_SIZE);
    this.rawBuffer.writeBigUInt64LE(0n, GLOBAL_HEADER_OFFSETS.UNDERRUN_COUNT);
    this.rawBuffer.writeBigUInt64LE(0n, GLOBAL_HEADER_OFFSETS.OVERRUN_COUNT);
    this.rawBuffer.writeUInt32LE(this.pid, GLOBAL_HEADER_OFFSETS.PID_WRITER);
    this.rawBuffer.writeBigInt64LE(BigInt(Date.now()) * 1000000n, GLOBAL_HEADER_OFFSETS.LAST_HEARTBEAT_NS);
    this.rawBuffer.writeUInt32LE(
      STATE_FLAGS.INITIALIZED | STATE_FLAGS.PRODUCER_ACTIVE,
      GLOBAL_HEADER_OFFSETS.STATE_FLAGS
    );
    this.rawBuffer.writeUInt32LE(48000, GLOBAL_HEADER_OFFSETS.SAMPLE_RATE);
    this.rawBuffer.writeUInt16LE(1, GLOBAL_HEADER_OFFSETS.CHANNELS);
  }

  _validateHeaderInMemory() {
    const magic = this.rawBuffer.readUInt32LE(GLOBAL_HEADER_OFFSETS.MAGIC);
    if (magic !== MAGIC_BYTES) {
      throw new Error(`Corrupt memory segment: expected magic 0x${MAGIC_BYTES.toString(16)}, got 0x${magic.toString(16)}`);
    }
  }

  _initializeHeaderOnFile() {
    this.headerBuffer.fill(0);
    this.headerBuffer.writeUInt32LE(MAGIC_BYTES, GLOBAL_HEADER_OFFSETS.MAGIC);
    this.headerBuffer.writeUInt16LE(PROTOCOL_VERSION, GLOBAL_HEADER_OFFSETS.VERSION);
    this.headerBuffer.writeUInt16LE(this.headerSize, GLOBAL_HEADER_OFFSETS.HEADER_SIZE);
    this.headerBuffer.writeBigUInt64LE(0n, GLOBAL_HEADER_OFFSETS.WRITE_INDEX);
    this.headerBuffer.writeBigUInt64LE(0n, GLOBAL_HEADER_OFFSETS.READ_INDEX);
    this.headerBuffer.writeUInt32LE(this.slotCount, GLOBAL_HEADER_OFFSETS.SLOT_COUNT);
    this.headerBuffer.writeUInt32LE(this.slotSize, GLOBAL_HEADER_OFFSETS.SLOT_SIZE);
    this.headerBuffer.writeBigUInt64LE(0n, GLOBAL_HEADER_OFFSETS.UNDERRUN_COUNT);
    this.headerBuffer.writeBigUInt64LE(0n, GLOBAL_HEADER_OFFSETS.OVERRUN_COUNT);
    this.headerBuffer.writeUInt32LE(this.pid, GLOBAL_HEADER_OFFSETS.PID_WRITER);
    this.headerBuffer.writeBigInt64LE(BigInt(Date.now()) * 1000000n, GLOBAL_HEADER_OFFSETS.LAST_HEARTBEAT_NS);
    this.headerBuffer.writeUInt32LE(
      STATE_FLAGS.INITIALIZED | STATE_FLAGS.PRODUCER_ACTIVE,
      GLOBAL_HEADER_OFFSETS.STATE_FLAGS
    );
    this.headerBuffer.writeUInt32LE(48000, GLOBAL_HEADER_OFFSETS.SAMPLE_RATE);
    this.headerBuffer.writeUInt16LE(1, GLOBAL_HEADER_OFFSETS.CHANNELS);

    fs.writeSync(this.fd, this.headerBuffer, 0, this.headerSize, 0);
  }

  _validateHeaderOnFile() {
    fs.readSync(this.fd, this.headerBuffer, 0, this.headerSize, 0);
    const magic = this.headerBuffer.readUInt32LE(GLOBAL_HEADER_OFFSETS.MAGIC);
    if (magic !== MAGIC_BYTES) {
      throw new Error(`Corrupt shared memory segment: expected magic 0x${MAGIC_BYTES.toString(16)}, got 0x${magic.toString(16)}`);
    }

    const version = this.headerBuffer.readUInt16LE(GLOBAL_HEADER_OFFSETS.VERSION);
    if (version !== PROTOCOL_VERSION) {
      throw new Error(`Unsupported ring buffer protocol version: ${version}`);
    }

    this.slotCount = this.headerBuffer.readUInt32LE(GLOBAL_HEADER_OFFSETS.SLOT_COUNT);
    this.slotSize = this.headerBuffer.readUInt32LE(GLOBAL_HEADER_OFFSETS.SLOT_SIZE);
    this.mask = BigInt(this.slotCount - 1);
    this.headerSize = this.headerBuffer.readUInt16LE(GLOBAL_HEADER_OFFSETS.HEADER_SIZE);
  }

  _readHeader() {
    if (this.inMemory) {
      return this.rawBuffer;
    }
    fs.readSync(this.fd, this.headerBuffer, 0, this.headerSize, 0);
    return this.headerBuffer;
  }

  _writeHeaderField(offset, length, writeFn) {
    if (this.inMemory) {
      writeFn(this.rawBuffer, offset);
      return;
    }
    const chunk = Buffer.alloc(length);
    writeFn(chunk, 0);
    fs.writeSync(this.fd, chunk, 0, length, offset);
  }

  /**
   * Write an audio frame into the shared memory circular queue.
   * @param {Object} frame
   * @param {number|bigint} frame.frameId
   * @param {number|bigint} [frame.timestampNs]
   * @param {Buffer|Uint8Array} frame.audioData
   * @param {number} [frame.sampleRate=48000]
   * @param {number} [frame.channels=1]
   * @param {number} [frame.flags=1]
   */
  writeFrame(frame) {
    if (!this.initialized) this.init();
    const rawData = frame ? (frame.audioData || frame.data) : null;
    if (!rawData) {
      throw new Error('Invalid audio frame: missing audioData');
    }

    const audioBuf = Buffer.isBuffer(rawData)
      ? rawData
      : Buffer.from(rawData.buffer || rawData, rawData.byteOffset || 0, rawData.byteLength || rawData.length);

    if (audioBuf.length > MAX_PAYLOAD_SIZE) {
      throw new Error(`Audio payload size ${audioBuf.length} exceeds max allowed ${MAX_PAYLOAD_SIZE}`);
    }

    const header = this._readHeader();
    const stateFlags = header.readUInt32LE(GLOBAL_HEADER_OFFSETS.STATE_FLAGS);
    if (stateFlags & STATE_FLAGS.SHUTDOWN) {
      throw new Error('Audio ring buffer is shut down');
    }

    const writeIdx = header.readBigUInt64LE(GLOBAL_HEADER_OFFSETS.WRITE_INDEX);
    const readIdx = header.readBigUInt64LE(GLOBAL_HEADER_OFFSETS.READ_INDEX);

    // Overrun backpressure check
    if (writeIdx - readIdx >= BigInt(this.slotCount)) {
      const currentOverruns = header.readBigUInt64LE(GLOBAL_HEADER_OFFSETS.OVERRUN_COUNT);
      this._writeHeaderField(GLOBAL_HEADER_OFFSETS.OVERRUN_COUNT, 8, (b, off) => {
        b.writeBigUInt64LE(currentOverruns + 1n, off);
      });
      return { success: false, reason: 'overrun', writeIndex: writeIdx, readIndex: readIdx };
    }

    const slotIdx = Number(writeIdx & this.mask);
    const slotOffset = this.headerSize + (slotIdx * this.slotSize);

    // Construct slot buffer
    this.slotBuffer.fill(0);
    this.slotBuffer.writeBigUInt64LE(BigInt(frame.frameId || 0), SLOT_HEADER_OFFSETS.FRAME_ID);
    this.slotBuffer.writeBigInt64LE(
      BigInt(frame.timestampNs !== undefined ? frame.timestampNs : Date.now() * 1000000),
      SLOT_HEADER_OFFSETS.TIMESTAMP_NS
    );
    this.slotBuffer.writeUInt32LE(audioBuf.length, SLOT_HEADER_OFFSETS.PAYLOAD_SIZE);
    this.slotBuffer.writeUInt16LE(frame.channels || 1, SLOT_HEADER_OFFSETS.CHANNELS);
    this.slotBuffer.writeUInt32LE(frame.sampleRate || 48000, SLOT_HEADER_OFFSETS.SAMPLE_RATE);
    this.slotBuffer.writeUInt16LE(frame.flags !== undefined ? frame.flags : FRAME_FLAGS.PCM_16_LE, SLOT_HEADER_OFFSETS.FLAGS);

    audioBuf.copy(this.slotBuffer, SLOT_HEADER_OFFSETS.PAYLOAD);

    if (this.inMemory) {
      this.slotBuffer.copy(this.rawBuffer, slotOffset);
      this.rawBuffer.writeUInt32LE(this.pid, GLOBAL_HEADER_OFFSETS.PID_WRITER);
      this.rawBuffer.writeBigInt64LE(BigInt(Date.now()) * 1000000n, GLOBAL_HEADER_OFFSETS.LAST_HEARTBEAT_NS);
      this.rawBuffer.writeBigUInt64LE(writeIdx + 1n, GLOBAL_HEADER_OFFSETS.WRITE_INDEX);
    } else {
      fs.writeSync(this.fd, this.slotBuffer, 0, this.slotSize, slotOffset);
      this._writeHeaderField(GLOBAL_HEADER_OFFSETS.PID_WRITER, 4, (b, off) => b.writeUInt32LE(this.pid, off));
      this._writeHeaderField(GLOBAL_HEADER_OFFSETS.LAST_HEARTBEAT_NS, 8, (b, off) => b.writeBigInt64LE(BigInt(Date.now()) * 1000000n, off));
      this._writeHeaderField(GLOBAL_HEADER_OFFSETS.WRITE_INDEX, 8, (b, off) => b.writeBigUInt64LE(writeIdx + 1n, off));
    }

    return {
      success: true,
      frameId: frame.frameId,
      writeIndex: writeIdx + 1n,
      payloadSize: audioBuf.length
    };
  }

  /**
   * Read the next sequential audio frame from the ring buffer.
   * @returns {Object|null} The audio frame or null if buffer is empty
   */
  readFrame() {
    if (!this.initialized) this.init();

    const header = this._readHeader();
    const stateFlags = header.readUInt32LE(GLOBAL_HEADER_OFFSETS.STATE_FLAGS);
    if (stateFlags & STATE_FLAGS.SHUTDOWN) {
      throw new Error('Audio ring buffer is shut down');
    }

    const writeIdx = header.readBigUInt64LE(GLOBAL_HEADER_OFFSETS.WRITE_INDEX);
    const readIdx = header.readBigUInt64LE(GLOBAL_HEADER_OFFSETS.READ_INDEX);

    // Underrun check
    if (writeIdx === readIdx) {
      const currentUnderruns = header.readBigUInt64LE(GLOBAL_HEADER_OFFSETS.UNDERRUN_COUNT);
      this._writeHeaderField(GLOBAL_HEADER_OFFSETS.UNDERRUN_COUNT, 8, (b, off) => {
        b.writeBigUInt64LE(currentUnderruns + 1n, off);
      });
      return null;
    }

    const slotIdx = Number(readIdx & this.mask);
    const slotOffset = this.headerSize + (slotIdx * this.slotSize);

    let currentSlotBuf;
    if (this.inMemory) {
      currentSlotBuf = this.rawBuffer.subarray(slotOffset, slotOffset + this.slotSize);
    } else {
      fs.readSync(this.fd, this.slotBuffer, 0, this.slotSize, slotOffset);
      currentSlotBuf = this.slotBuffer;
    }

    const frameId = currentSlotBuf.readBigUInt64LE(SLOT_HEADER_OFFSETS.FRAME_ID);
    const timestampNs = currentSlotBuf.readBigInt64LE(SLOT_HEADER_OFFSETS.TIMESTAMP_NS);
    const payloadSize = currentSlotBuf.readUInt32LE(SLOT_HEADER_OFFSETS.PAYLOAD_SIZE);
    const channels = currentSlotBuf.readUInt16LE(SLOT_HEADER_OFFSETS.CHANNELS);
    const sampleRate = currentSlotBuf.readUInt32LE(SLOT_HEADER_OFFSETS.SAMPLE_RATE);
    const flags = currentSlotBuf.readUInt16LE(SLOT_HEADER_OFFSETS.FLAGS);

    if (payloadSize > MAX_PAYLOAD_SIZE) {
      // Advance read index past corrupt slot to prevent consumer deadlock
      if (this.inMemory) {
        this.rawBuffer.writeBigUInt64LE(readIdx + 1n, GLOBAL_HEADER_OFFSETS.READ_INDEX);
      } else {
        this._writeHeaderField(GLOBAL_HEADER_OFFSETS.READ_INDEX, 8, (b, off) => b.writeBigUInt64LE(readIdx + 1n, off));
      }
      throw new Error(`Corrupt slot payload size: ${payloadSize} exceeds max ${MAX_PAYLOAD_SIZE}`);
    }

    const audioData = Buffer.allocUnsafe(payloadSize);
    currentSlotBuf.copy(audioData, 0, SLOT_HEADER_OFFSETS.PAYLOAD, SLOT_HEADER_OFFSETS.PAYLOAD + payloadSize);

    // Advance read index
    if (this.inMemory) {
      this.rawBuffer.writeUInt32LE(this.pid, GLOBAL_HEADER_OFFSETS.PID_READER);
      this.rawBuffer.writeBigUInt64LE(readIdx + 1n, GLOBAL_HEADER_OFFSETS.READ_INDEX);
    } else {
      this._writeHeaderField(GLOBAL_HEADER_OFFSETS.PID_READER, 4, (b, off) => b.writeUInt32LE(this.pid, off));
      this._writeHeaderField(GLOBAL_HEADER_OFFSETS.READ_INDEX, 8, (b, off) => b.writeBigUInt64LE(readIdx + 1n, off));
    }

    return {
      frameId: Number(frameId),
      timestampNs: Number(timestampNs),
      payloadSize,
      channels,
      sampleRate,
      flags,
      data: audioData
    };
  }

  /**
   * Retrieve real-time telemetry and buffer occupancy metrics.
   */
  getMetrics() {
    if (!this.initialized) this.init();

    const header = this._readHeader();
    const writeIdx = header.readBigUInt64LE(GLOBAL_HEADER_OFFSETS.WRITE_INDEX);
    const readIdx = header.readBigUInt64LE(GLOBAL_HEADER_OFFSETS.READ_INDEX);
    const underrunCount = header.readBigUInt64LE(GLOBAL_HEADER_OFFSETS.UNDERRUN_COUNT);
    const overrunCount = header.readBigUInt64LE(GLOBAL_HEADER_OFFSETS.OVERRUN_COUNT);
    const writerPid = header.readUInt32LE(GLOBAL_HEADER_OFFSETS.PID_WRITER);
    const readerPid = header.readUInt32LE(GLOBAL_HEADER_OFFSETS.PID_READER);
    const lastHeartbeatNs = header.readBigInt64LE(GLOBAL_HEADER_OFFSETS.LAST_HEARTBEAT_NS);
    const stateFlags = header.readUInt32LE(GLOBAL_HEADER_OFFSETS.STATE_FLAGS);

    const depth = writeIdx >= readIdx ? Number(writeIdx - readIdx) : 0;
    const fillPercent = this.slotCount > 0 ? (depth / this.slotCount) * 100 : 0;
    const nowNs = BigInt(Date.now()) * 1000000n;
    const isWriterAlive = (nowNs - lastHeartbeatNs) < 5000000000n; // 5s threshold

    // Approx 20ms audio frame duration
    const estimatedLagMs = depth * 20;

    return {
      writeIndex: Number(writeIdx),
      readIndex: Number(readIdx),
      queueDepth: depth,
      slotCapacity: this.slotCount,
      fillPercent: Math.round(fillPercent * 10) / 10,
      underrunCount: Number(underrunCount),
      overrunCount: Number(overrunCount),
      writerPid,
      readerPid,
      lastHeartbeatNs: Number(lastHeartbeatNs),
      isWriterAlive,
      stateFlags,
      estimatedLagMs
    };
  }

  /**
   * Reset the circular queue indices to zero.
   */
  reset() {
    if (!this.initialized) this.init();

    if (this.inMemory) {
      this.rawBuffer.writeBigUInt64LE(0n, GLOBAL_HEADER_OFFSETS.WRITE_INDEX);
      this.rawBuffer.writeBigUInt64LE(0n, GLOBAL_HEADER_OFFSETS.READ_INDEX);
      this.rawBuffer.writeBigUInt64LE(0n, GLOBAL_HEADER_OFFSETS.UNDERRUN_COUNT);
      this.rawBuffer.writeBigUInt64LE(0n, GLOBAL_HEADER_OFFSETS.OVERRUN_COUNT);
    } else {
      this._writeHeaderField(GLOBAL_HEADER_OFFSETS.WRITE_INDEX, 8, (b, off) => b.writeBigUInt64LE(0n, off));
      this._writeHeaderField(GLOBAL_HEADER_OFFSETS.READ_INDEX, 8, (b, off) => b.writeBigUInt64LE(0n, off));
      this._writeHeaderField(GLOBAL_HEADER_OFFSETS.UNDERRUN_COUNT, 8, (b, off) => b.writeBigUInt64LE(0n, off));
      this._writeHeaderField(GLOBAL_HEADER_OFFSETS.OVERRUN_COUNT, 8, (b, off) => b.writeBigUInt64LE(0n, off));
    }
  }

  /**
   * Recover stale or orphaned buffer state if writer has crashed.
   */
  recoverStaleState(maxStaleNs = 5000000000n) {
    if (!this.initialized) this.init();
    const header = this._readHeader();
    const lastHeartbeat = header.readBigInt64LE(GLOBAL_HEADER_OFFSETS.LAST_HEARTBEAT_NS);
    const nowNs = BigInt(Date.now()) * 1000000n;

    if (nowNs - lastHeartbeat > BigInt(maxStaleNs)) {
      this.reset();
      return true;
    }
    return false;
  }

  /**
   * Close the bridge and release file descriptors.
   */
  close() {
    if (this.initialized) {
      try {
        const header = this._readHeader();
        const flags = header.readUInt32LE(GLOBAL_HEADER_OFFSETS.STATE_FLAGS);
        this._writeHeaderField(GLOBAL_HEADER_OFFSETS.STATE_FLAGS, 4, (b, off) => {
          b.writeUInt32LE(flags | STATE_FLAGS.SHUTDOWN, off);
        });
      } catch (e) {}

      if (this.fd !== null) {
        try {
          fs.closeSync(this.fd);
        } catch (e) {}
        this.fd = null;
      }
      this.initialized = false;
    }
  }
}

/**
 * Register Electron IPC handlers for the Audio Bridge.
 * @param {Electron.IpcMain} ipcMain
 * @param {SharedMemoryAudioBridge} [bridge]
 */
function registerAudioBridgeIpc(ipcMain, bridge = null) {
  if (!ipcMain || typeof ipcMain.handle !== 'function') {
    return { unregister: () => {} };
  }

  // Guard: remove any existing handlers before re-registering to prevent
  // "second handler" errors when registerAudioBridgeIpc is called more than once.
  const channels = Object.values(AUDIO_RING_CHANNELS);
  channels.forEach(ch => {
    try { ipcMain.removeHandler(ch); } catch (_) {}
  });

  const audioBridge = bridge || new SharedMemoryAudioBridge();

  ipcMain.handle(AUDIO_RING_CHANNELS.INIT, async () => {
    try {
      audioBridge.init();
      return { success: true, metrics: audioBridge.getMetrics() };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle(AUDIO_RING_CHANNELS.READ_FRAME, async () => {
    try {
      const frame = audioBridge.readFrame();
      return { success: true, frame };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle(AUDIO_RING_CHANNELS.WRITE_FRAME, async (_event, frameData) => {
    try {
      const result = audioBridge.writeFrame(frameData);
      return result;
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle(AUDIO_RING_CHANNELS.GET_METRICS, async () => {
    try {
      return { success: true, metrics: audioBridge.getMetrics() };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle(AUDIO_RING_CHANNELS.RESET, async () => {
    try {
      audioBridge.reset();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle(AUDIO_RING_CHANNELS.CLOSE, async () => {
    try {
      audioBridge.close();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  return {
    bridge: audioBridge,
    unregister: () => {
      if (typeof ipcMain.removeHandler === 'function') {
        ipcMain.removeHandler(AUDIO_RING_CHANNELS.INIT);
        ipcMain.removeHandler(AUDIO_RING_CHANNELS.READ_FRAME);
        ipcMain.removeHandler(AUDIO_RING_CHANNELS.WRITE_FRAME);
        ipcMain.removeHandler(AUDIO_RING_CHANNELS.GET_METRICS);
        ipcMain.removeHandler(AUDIO_RING_CHANNELS.RESET);
        ipcMain.removeHandler(AUDIO_RING_CHANNELS.CLOSE);
      }
    }
  };
}

module.exports = {
  SharedMemoryAudioBridge,
  registerAudioBridgeIpc
};
