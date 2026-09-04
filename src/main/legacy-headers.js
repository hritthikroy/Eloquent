/**
 * Eloquent Main - Legacy Headers Processor
 * 
 * Strips out deprecated header validation logic and suppress ghost signal warnings
 * that previously consumed CPU cycles and polluted logs during continuous PCM audio streaming.
 */

// Deprecated legacy header identifiers
const LEGACY_HEADER_MAGIC = Buffer.from([0x53, 0x59, 0x4E, 0x43]); // 'SYNC'
const LEGACY_FLUSH_MARKER = Buffer.from([0xFF, 0xFE, 0xFD, 0xFC]); // Deprecated flush sync marker
const LEGACY_HEADER_SIZE = 16;

/**
 * Check if a raw incoming buffer begins with deprecated legacy sync header bytes.
 * Optimized for zero memory allocations on hot audio paths.
 * 
 * @param {Buffer} buffer - Audio payload buffer
 * @returns {boolean}
 */
function hasLegacyHeader(buffer) {
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length < 4) {
    return false;
  }

  // Fast integer comparison of first 4 bytes
  return (
    buffer[0] === LEGACY_HEADER_MAGIC[0] &&
    buffer[1] === LEGACY_HEADER_MAGIC[1] &&
    buffer[2] === LEGACY_HEADER_MAGIC[2] &&
    buffer[3] === LEGACY_HEADER_MAGIC[3]
  );
}

/**
 * Check if buffer contains a deprecated flush delimiter signal.
 * Legacy flush signals are now ignored to eliminate synchronization stalls.
 * 
 * @param {Buffer} buffer 
 * @returns {boolean}
 */
function isLegacyFlushSignal(buffer) {
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length < 4) {
    return false;
  }

  return (
    buffer[0] === LEGACY_FLUSH_MARKER[0] &&
    buffer[1] === LEGACY_FLUSH_MARKER[1] &&
    buffer[2] === LEGACY_FLUSH_MARKER[2] &&
    buffer[3] === LEGACY_FLUSH_MARKER[3]
  );
}

/**
 * Strip legacy sync headers from raw audio buffer if present.
 * Uses Buffer.subarray for zero-copy slicing.
 * 
 * Crucially: Suppresses all deprecated warning logs ("ghost signal warnings")
 * to guarantee clean console output and eliminate CPU cycle overhead on 48kHz audio loops.
 * 
 * @param {Buffer} buffer - Ingested audio buffer
 * @returns {Buffer} - Clean PCM payload buffer (zero-copy reference)
 */
function stripLegacyHeaders(buffer) {
  if (!buffer || !Buffer.isBuffer(buffer)) {
    return buffer;
  }

  // Fast path: Pure raw PCM data (99.9% of production traffic)
  if (!hasLegacyHeader(buffer)) {
    return buffer;
  }

  // Deprecated header detected: strip 16-byte legacy envelope cleanly
  // Notice: NO warning logs emitted. Ghost signals are silently eliminated.
  if (buffer.length >= LEGACY_HEADER_SIZE) {
    return buffer.subarray(LEGACY_HEADER_SIZE);
  }

  return buffer;
}

/**
 * Validate headers - modern no-op validator that permits clean continuous audio frames
 * without enforcing deprecated sync delimiters or throwing ghost signal errors.
 * 
 * @param {Buffer} buffer 
 * @returns {{ valid: boolean, hasLegacy: boolean, cleanBuffer: Buffer }}
 */
function validateHeaders(buffer) {
  if (!buffer || !Buffer.isBuffer(buffer)) {
    return {
      valid: false,
      hasLegacy: false,
      cleanBuffer: buffer
    };
  }

  const legacy = hasLegacyHeader(buffer);
  const clean = legacy ? stripLegacyHeaders(buffer) : buffer;

  return {
    valid: true,
    hasLegacy: legacy,
    cleanBuffer: clean
  };
}

module.exports = {
  LEGACY_HEADER_MAGIC,
  LEGACY_FLUSH_MARKER,
  LEGACY_HEADER_SIZE,
  LEGACY_WARNINGS_SUPPRESSED: true,
  hasLegacyHeader,
  isLegacyFlushSignal,
  stripLegacyHeaders,
  validateHeaders
};
