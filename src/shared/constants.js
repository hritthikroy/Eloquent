/**
 * Shared Memory Ring Buffer IPC Layout Constants
 * 
 * Defines structural memory layouts, buffer sizes, atomic offset markers,
 * and IPC channel identifiers shared across Node.js/Electron and Go audio runtimes.
 */

// Magic number: "ELQA" (Eloquent Audio) in ASCII / Little-Endian uint32 (0x41514C45) / Big-Endian (0x454C5141)
const MAGIC_BYTES = 0x454C5141; // 1162629441
const PROTOCOL_VERSION = 1;

// Default backing file paths
const DEFAULT_SHM_PATH_POSIX = '/tmp/eloquent_audio_shm.bin';
const DEFAULT_SHM_NAME_WIN = 'Global\\EloquentAudioShm';

// Memory segment topology
const HEADER_SIZE = 128;              // Cacheline-aligned (128 bytes)
const DEFAULT_SLOT_COUNT = 256;       // Must be power-of-two (2^8)
const DEFAULT_SLOT_SIZE = 4096;       // Page-aligned (4KB per slot)
const SLOT_HEADER_SIZE = 32;          // 32 bytes per slot header
const MAX_PAYLOAD_SIZE = DEFAULT_SLOT_SIZE - SLOT_HEADER_SIZE; // 4064 bytes

// Total allocation: 128 + (256 * 4096) = 1,048,704 bytes (~1.0 MB)
const TOTAL_SEGMENT_SIZE = HEADER_SIZE + (DEFAULT_SLOT_COUNT * DEFAULT_SLOT_SIZE);

// Global Header Byte Offsets (128 bytes total)
const GLOBAL_HEADER_OFFSETS = {
  MAGIC: 0,               // uint32 (4 bytes)
  VERSION: 4,             // uint16 (2 bytes)
  HEADER_SIZE: 6,         // uint16 (2 bytes)
  WRITE_INDEX: 8,         // uint64 (8 bytes, atomic monotonic write sequence)
  READ_INDEX: 16,         // uint64 (8 bytes, atomic monotonic read sequence)
  SLOT_COUNT: 24,         // uint32 (4 bytes, power of 2)
  SLOT_SIZE: 28,          // uint32 (4 bytes)
  UNDERRUN_COUNT: 32,     // uint64 (8 bytes, atomic counter)
  OVERRUN_COUNT: 40,      // uint64 (8 bytes, atomic counter)
  PID_WRITER: 48,         // uint32 (4 bytes, active writer PID)
  PID_READER: 52,         // uint32 (4 bytes, active reader PID)
  LAST_HEARTBEAT_NS: 56,  // int64  (8 bytes, Unix timestamp ns)
  STATE_FLAGS: 64,        // uint32 (4 bytes, protocol state flags)
  SAMPLE_RATE: 68,        // uint32 (4 bytes, default 48000)
  CHANNELS: 72,           // uint16 (2 bytes, default 1)
  RESERVED: 74            // 54 bytes padding to align to 128 bytes
};

// Slot Header Byte Offsets (32 bytes total, relative to slot start)
const SLOT_HEADER_OFFSETS = {
  FRAME_ID: 0,            // uint64 (8 bytes)
  TIMESTAMP_NS: 8,        // int64  (8 bytes, capture timestamp in ns)
  PAYLOAD_SIZE: 16,       // uint32 (4 bytes, actual audio payload size)
  CHANNELS: 20,           // uint16 (2 bytes)
  SAMPLE_RATE: 22,        // uint32 (4 bytes)
  FLAGS: 26,              // uint16 (2 bytes, frame flags)
  RESERVED: 28,           // 4 bytes padding
  PAYLOAD: 32             // Audio payload data starts at byte 32
};

// Protocol State Flags (bitmask)
const STATE_FLAGS = {
  UNINITIALIZED: 0x00,
  INITIALIZED: 0x01,
  PRODUCER_ACTIVE: 0x02,
  CONSUMER_ACTIVE: 0x04,
  SHUTDOWN: 0x08,
  OVERRUN_DETECTED: 0x10,
  UNDERRUN_DETECTED: 0x20
};

// Frame Flags (bitmask)
const FRAME_FLAGS = {
  PCM_16_LE: 0x01,        // Standard 16-bit Signed Integer PCM Little-Endian
  SPEECH_ACTIVE: 0x02,    // VAD Speech frame
  END_OF_STREAM: 0x04,    // Last frame of an utterance
  TELEMETRY: 0x08         // Telemetry / sync marker frame
};

// Standard IPC Channel Identifiers
const AUDIO_RING_CHANNELS = {
  INIT: 'audio-ring:init',
  READ_FRAME: 'audio-ring:read-frame',
  WRITE_FRAME: 'audio-ring:write-frame',
  GET_METRICS: 'audio-ring:get-metrics',
  RESET: 'audio-ring:reset',
  CLOSE: 'audio-ring:close'
};

module.exports = {
  MAGIC_BYTES,
  PROTOCOL_VERSION,
  DEFAULT_SHM_PATH_POSIX,
  DEFAULT_SHM_NAME_WIN,
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
};
