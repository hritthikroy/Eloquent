export const MAGIC_BYTES: number;
export const PROTOCOL_VERSION: number;
export const DEFAULT_SHM_PATH_POSIX: string;
export const DEFAULT_SHM_NAME_WIN: string;
export const HEADER_SIZE: number;
export const DEFAULT_SLOT_COUNT: number;
export const DEFAULT_SLOT_SIZE: number;
export const SLOT_HEADER_SIZE: number;
export const MAX_PAYLOAD_SIZE: number;
export const TOTAL_SEGMENT_SIZE: number;

export const GLOBAL_HEADER_OFFSETS: {
  MAGIC: number;
  VERSION: number;
  HEADER_SIZE: number;
  WRITE_INDEX: number;
  READ_INDEX: number;
  SLOT_COUNT: number;
  SLOT_SIZE: number;
  UNDERRUN_COUNT: number;
  OVERRUN_COUNT: number;
  PID_WRITER: number;
  PID_READER: number;
  LAST_HEARTBEAT_NS: number;
  STATE_FLAGS: number;
  SAMPLE_RATE: number;
  CHANNELS: number;
  RESERVED: number;
};

export const SLOT_HEADER_OFFSETS: {
  FRAME_ID: number;
  TIMESTAMP_NS: number;
  PAYLOAD_SIZE: number;
  CHANNELS: number;
  SAMPLE_RATE: number;
  FLAGS: number;
  RESERVED: number;
  PAYLOAD: number;
};

export const STATE_FLAGS: {
  UNINITIALIZED: number;
  INITIALIZED: number;
  PRODUCER_ACTIVE: number;
  CONSUMER_ACTIVE: number;
  SHUTDOWN: number;
  OVERRUN_DETECTED: number;
  UNDERRUN_DETECTED: number;
};

export const FRAME_FLAGS: {
  PCM_16_LE: number;
  SPEECH_ACTIVE: number;
  END_OF_STREAM: number;
  TELEMETRY: number;
};

export const AUDIO_RING_CHANNELS: {
  INIT: string;
  READ_FRAME: string;
  WRITE_FRAME: string;
  GET_METRICS: string;
  RESET: string;
  CLOSE: string;
};
