/**
 * AudioSyncService
 * 
 * Provides real-time audio synchronization between WebRTC audio chunks
 * and dynamic text/poetry rendering:
 * 1. Monotonic packet sequence tracking & client-side jitter buffer
 * 2. Real-time stream clock alignment and drift compensation
 * 3. Frame-locked typography updates batched via requestAnimationFrame
 * 4. Error recovery for jitter spikes, packet drops, and out-of-order chunks
 * 5. Comprehensive sync telemetry tracking
 */

export interface StreamMarker {
  markerId: string;
  verseIndex: number;
  wordOffset: number;
  targetTimestampMs: number;
  durationMs: number;
  text: string;
  phonemes?: string;
  metadata?: Record<string, any>;
}

export interface JitterStats {
  packetDelayMs: number;
  jitterVarianceMs: number;
  packetsLost: number;
  outOfOrderCount: number;
  bufferDepth: number;
  bufferUnderruns: number;
}

export interface AudioChunkMetadata {
  chunkId: string;
  sequenceNumber: number;
  timestampMs: number;
  sampleRate: number;
  channels: number;
  byteLength: number;
  durationMs: number;
  checksum: string;
  marker?: StreamMarker;
  jitterStats: JitterStats;
}

export type SyncState = 'synchronized' | 'buffering' | 'recovering' | 'desynced';

export interface SyncTelemetry {
  sessionId: string;
  totalChunksReceived: number;
  packetsLost: number;
  outOfOrderCount: number;
  bufferUnderruns: number;
  averageJitterMs: number;
  maxJitterMs: number;
  streamClockMs: number;
  activeMarkersReached: number;
  syncState: SyncState;
  desyncDeltaMs: number;
  lastEventTimestamp: number;
}

export interface TypographyUpdate {
  verseIndex: number;
  wordOffset: number;
  activeWord: string;
  progress: number;
  markerId?: string;
}

export interface PoemVerse {
  verseIndex: number;
  text: string;
  words: Array<{
    word: string;
    offset: number;
    timestampMs?: number;
    durationMs?: number;
  }>;
  isActive?: boolean;
  isCompleted?: boolean;
}

export type MarkerListener = (marker: StreamMarker) => void;
export type TypographyListener = (update: TypographyUpdate) => void;
export type TelemetryListener = (telemetry: SyncTelemetry) => void;
export type DesyncListener = (deltaMs: number, reason: string) => void;
export type ResyncListener = () => void;

export interface AudioSyncServiceOptions {
  maxJitterWindow?: number;
  desyncThresholdMs?: number;
  targetLatencyMs?: number;
  adaptiveBuffering?: boolean;
}

export class AudioSyncService {
  private sessionId: string;
  private options: Required<AudioSyncServiceOptions>;
  
  // Stream Clock & Sequencing State
  private streamClockMs: number = 0;
  private lastSeqSeen: number = 0;
  private isInitialized: boolean = false;
  private startTimeMs: number = 0;
  
  // Jitter Buffer & Reordering Window
  private jitterWindow: AudioChunkMetadata[] = [];
  private outOfOrderCount: number = 0;
  private packetsLost: number = 0;
  private bufferUnderruns: number = 0;
  private jitterVarianceMs: number = 0;
  private prevTransitMs: number = 0;
  private maxJitterSeen: number = 0;
  private totalChunksReceived: number = 0;
  private markersReachedCount: number = 0;
  
  // Frame-Locked Dispatch Batching
  private pendingTypographyUpdate: TypographyUpdate | null = null;
  private rafId: any = null;
  
  // Event Listeners
  private markerListeners: Set<MarkerListener> = new Set();
  private typographyListeners: Set<TypographyListener> = new Set();
  private telemetryListeners: Set<TelemetryListener> = new Set();
  private desyncListeners: Set<DesyncListener> = new Set();
  private resyncListeners: Set<ResyncListener> = new Set();

  constructor(sessionId: string = 'default-stream', options: AudioSyncServiceOptions = {}) {
    this.sessionId = sessionId;
    this.options = {
      maxJitterWindow: options.maxJitterWindow ?? 50,
      desyncThresholdMs: options.desyncThresholdMs ?? 45,
      targetLatencyMs: options.targetLatencyMs ?? 20,
      adaptiveBuffering: options.adaptiveBuffering ?? true
    };
    this.startTimeMs = Date.now();
  }

  /**
   * Ingests a new audio chunk from WebRTC stream, passes it through the jitter buffer,
   * re-aligns stream timing, and dispatches frame-locked typography events.
   */
  public ingestChunk(chunk: AudioChunkMetadata): void {
    this.totalChunksReceived++;
    const now = Date.now();
    const transitMs = Math.max(0, now - chunk.timestampMs);

    // RFC 3550 Jitter Estimation
    if (this.prevTransitMs > 0) {
      const diff = Math.abs(transitMs - this.prevTransitMs);
      this.jitterVarianceMs += (diff - this.jitterVarianceMs) / 16.0;
      if (this.jitterVarianceMs > this.maxJitterSeen) {
        this.maxJitterSeen = this.jitterVarianceMs;
      }
    }
    this.prevTransitMs = transitMs;

    if (!this.isInitialized) {
      this.lastSeqSeen = chunk.sequenceNumber;
      this.isInitialized = true;
      this.streamClockMs = chunk.durationMs;
      this.jitterWindow.push(chunk);
      this.processChunkPayload(chunk);
      return;
    }

    // Sequence analysis: detect out-of-order or dropped packets
    if (chunk.sequenceNumber <= this.lastSeqSeen) {
      this.outOfOrderCount++;
      if (this.packetsLost > 0) {
        this.packetsLost--;
      }
    } else if (chunk.sequenceNumber > this.lastSeqSeen + 1) {
      const dropped = chunk.sequenceNumber - this.lastSeqSeen - 1;
      this.packetsLost += dropped;
      this.notifyDesync(dropped * chunk.durationMs, `Detected ${dropped} dropped audio packets`);
    }

    if (chunk.sequenceNumber > this.lastSeqSeen) {
      this.lastSeqSeen = chunk.sequenceNumber;
    }

    // Insert into sorted jitter window
    this.jitterWindow.push(chunk);
    this.jitterWindow.sort((a, b) => a.sequenceNumber - b.sequenceNumber);

    if (this.jitterWindow.length > this.options.maxJitterWindow) {
      this.jitterWindow.shift();
    }

    // Advance continuous stream clock
    this.streamClockMs += chunk.durationMs;

    // Detect drift between stream clock and audio chunk timestamp
    const expectedStreamTime = chunk.durationMs * chunk.sequenceNumber;
    const driftMs = Math.abs(this.streamClockMs - expectedStreamTime);
    if (driftMs > this.options.desyncThresholdMs) {
      this.notifyDesync(driftMs, `Stream clock drift: ${driftMs.toFixed(1)}ms`);
      // Adaptive soft-sync drift compensation
      this.streamClockMs = expectedStreamTime;
      this.notifyResync();
    }

    this.processChunkPayload(chunk);
    this.emitTelemetry();
  }

  /**
   * Evaluates active markers and schedules frame-accurate typography updates.
   */
  private processChunkPayload(chunk: AudioChunkMetadata): void {
    if (chunk.marker) {
      this.markersReachedCount++;
      this.markerListeners.forEach(listener => {
        try { listener(chunk.marker!); } catch (e) { console.error('Marker listener error:', e); }
      });

      const words = chunk.marker.text.trim().split(/\s+/);
      const activeWord = words[chunk.marker.wordOffset] || words[0] || '';
      const progress = words.length > 0 ? (chunk.marker.wordOffset + 1) / words.length : 1.0;

      this.scheduleTypographyUpdate({
        verseIndex: chunk.marker.verseIndex,
        wordOffset: chunk.marker.wordOffset,
        activeWord,
        progress,
        markerId: chunk.marker.markerId
      });
    }
  }

  /**
   * Batches typography renders via requestAnimationFrame (or immediate microtask fallback).
   */
  private scheduleTypographyUpdate(update: TypographyUpdate): void {
    this.pendingTypographyUpdate = update;

    if (this.rafId !== null) {
      return;
    }

    const dispatch = () => {
      this.rafId = null;
      if (this.pendingTypographyUpdate) {
        const payload = this.pendingTypographyUpdate;
        this.pendingTypographyUpdate = null;
        this.typographyListeners.forEach(listener => {
          try { listener(payload); } catch (e) { console.error('Typography listener error:', e); }
        });
      }
    };

    if (typeof requestAnimationFrame === 'function') {
      this.rafId = requestAnimationFrame(dispatch);
    } else if (typeof setImmediate === 'function') {
      this.rafId = setImmediate(dispatch);
    } else {
      this.rafId = setTimeout(dispatch, 0);
    }
  }

  /**
   * Dispatches desync alerts when network jitter or packet loss triggers divergence.
   */
  private notifyDesync(deltaMs: number, reason: string): void {
    this.desyncListeners.forEach(listener => {
      try { listener(deltaMs, reason); } catch (e) { console.error('Desync listener error:', e); }
    });
  }

  /**
   * Dispatches resync recovery notifications once alignment is restored.
   */
  private notifyResync(): void {
    this.resyncListeners.forEach(listener => {
      try { listener(); } catch (e) { console.error('Resync listener error:', e); }
    });
  }

  /**
   * Generates and dispatches a comprehensive snapshot of stream sync telemetry.
   */
  public getTelemetry(): SyncTelemetry {
    let syncState: SyncState = 'synchronized';
    if (this.packetsLost > 5 || this.jitterVarianceMs > this.options.desyncThresholdMs) {
      syncState = 'recovering';
    } else if (this.jitterVarianceMs > 25 || this.outOfOrderCount > 2) {
      syncState = 'buffering';
    } else if (this.bufferUnderruns > 2) {
      syncState = 'desynced';
    }

    return {
      sessionId: this.sessionId,
      totalChunksReceived: this.totalChunksReceived,
      packetsLost: this.packetsLost,
      outOfOrderCount: this.outOfOrderCount,
      bufferUnderruns: this.bufferUnderruns,
      averageJitterMs: Math.round(this.jitterVarianceMs * 100) / 100,
      maxJitterMs: Math.round(this.maxJitterSeen * 100) / 100,
      streamClockMs: Math.round(this.streamClockMs),
      activeMarkersReached: this.markersReachedCount,
      syncState,
      desyncDeltaMs: Math.round(this.prevTransitMs),
      lastEventTimestamp: Date.now()
    };
  }

  private emitTelemetry(): void {
    if (this.telemetryListeners.size === 0) return;
    const telemetry = this.getTelemetry();
    this.telemetryListeners.forEach(listener => {
      try { listener(telemetry); } catch (e) { console.error('Telemetry listener error:', e); }
    });
  }

  // Listener Registration Methods
  public onMarkerReached(listener: MarkerListener): () => void {
    this.markerListeners.add(listener);
    return () => this.markerListeners.delete(listener);
  }

  public onTypographyUpdate(listener: TypographyListener): () => void {
    this.typographyListeners.add(listener);
    return () => this.typographyListeners.delete(listener);
  }

  public onTelemetry(listener: TelemetryListener): () => void {
    this.telemetryListeners.add(listener);
    return () => this.telemetryListeners.delete(listener);
  }

  public onDesyncAlert(listener: DesyncListener): () => void {
    this.desyncListeners.add(listener);
    return () => this.desyncListeners.delete(listener);
  }

  public onResynced(listener: ResyncListener): () => void {
    this.resyncListeners.add(listener);
    return () => this.resyncListeners.delete(listener);
  }

  public reset(): void {
    if (this.rafId !== null) {
      if (typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(this.rafId);
      } else if (typeof clearImmediate === 'function') {
        clearImmediate(this.rafId);
      } else {
        clearTimeout(this.rafId);
      }
      this.rafId = null;
    }
    this.streamClockMs = 0;
    this.lastSeqSeen = 0;
    this.isInitialized = false;
    this.jitterWindow = [];
    this.outOfOrderCount = 0;
    this.packetsLost = 0;
    this.bufferUnderruns = 0;
    this.jitterVarianceMs = 0;
    this.prevTransitMs = 0;
    this.maxJitterSeen = 0;
    this.totalChunksReceived = 0;
    this.markersReachedCount = 0;
    this.pendingTypographyUpdate = null;
  }
}
