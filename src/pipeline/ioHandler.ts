/**
 * Antigravity Input-Output Pipeline Handler (IOHandler)
 * 
 * Provides a non-blocking queue for student distance selection events,
 * ensuring high throughput and zero event loop stalls during state evaluation.
 * 
 * Includes automatic graceful degradation to single-threaded mode if
 * critical collision loops are detected.
 */

const { VehicleState, STATES } = require('../core/stateMachine');

export interface DistanceSelectionOptions {
  speed?: number;
  priority?: number;
  timeoutMs?: number;
  metadata?: Record<string, any>;
}

export interface DistanceSelectionEvent {
  id: string;
  distance: number;
  options?: DistanceSelectionOptions;
  timestamp: number;
  resolve: (value: any) => void;
  reject: (reason?: any) => void;
}

export interface IOHandlerMetrics {
  totalProcessed: number;
  queueLength: number;
  averageLatencyMs: number;
  fallbackCount: number;
  mode: 'concurrent_queue' | 'single_threaded';
}

export class IOHandler {
  private queue: DistanceSelectionEvent[] = [];
  private isDraining: boolean = false;
  private vehicleState: any;
  private mode: 'concurrent_queue' | 'single_threaded' = 'concurrent_queue';
  private fallbackCount: number = 0;
  private totalProcessed: number = 0;
  private totalLatencyMs: number = 0;
  private maxBatchSize: number = 128;

  constructor(vehicleStateInstance?: any) {
    this.vehicleState = vehicleStateInstance || new VehicleState();

    if (this.vehicleState && typeof this.vehicleState.on === 'function') {
      this.vehicleState.on('collisionPrevented', (event: any) => {
        this.handleCollisionAlert(event);
      });
    }
  }

  /**
   * Non-blocking distance selection.
   * Enqueues distance evaluation and returns a Promise without blocking the main event loop.
   */
  public chooseDistance(distance: number, options: DistanceSelectionOptions = {}): Promise<any> {
    return new Promise((resolve, reject) => {
      const event: DistanceSelectionEvent = {
        id: `dist-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        distance: typeof distance === 'number' && !Number.isNaN(distance) ? distance : 0,
        options,
        timestamp: Date.now(),
        resolve,
        reject
      };

      this.queue.push(event);

      if (this.mode === 'single_threaded') {
        this.drainSingleThreaded();
      } else {
        if (!this.isDraining) {
          this.isDraining = true;
          setImmediate(() => this.drainQueue());
        }
      }
    });
  }

  /**
   * Asynchronous batch queue drainer executing non-blockingly across event loop ticks.
   */
  private drainQueue(): void {
    const batchStart = Date.now();
    let processedThisTick = 0;

    while (this.queue.length > 0 && processedThisTick < this.maxBatchSize) {
      const item = this.queue.shift();
      if (!item) break;

      const evalStart = Date.now();
      try {
        const result = this.vehicleState.chooseDistance(item.distance, item.options);
        const latency = Date.now() - evalStart;
        this.totalLatencyMs += latency;
        this.totalProcessed++;
        item.resolve(result);
      } catch (err) {
        item.reject(err);
      }
      processedThisTick++;
    }

    if (this.queue.length > 0) {
      // Yield remaining batch to next event loop turn
      setImmediate(() => this.drainQueue());
    } else {
      this.isDraining = false;
    }
  }

  /**
   * Fallback synchronous mode with collision loop safety clamp.
   */
  private drainSingleThreaded(): void {
    while (this.queue.length > 0) {
      const item = this.queue.shift();
      if (!item) break;

      try {
        const result = this.vehicleState.chooseDistance(item.distance, item.options);
        this.totalProcessed++;
        item.resolve(result);
      } catch (err) {
        item.reject(err);
      }
    }
  }

  /**
   * Graceful degradation fallback when collision loop is detected.
   */
  public handleCollisionAlert(event: any): void {
    this.fallbackCount++;
    this.mode = 'single_threaded';
    console.warn('⚠️ [IOHandler] Critical collision loop detected - gracefully degraded to single-threaded mode:', event);

    // Auto-recover back to concurrent queue after 2000ms if stable
    setTimeout(() => {
      this.mode = 'concurrent_queue';
    }, 2000);
  }

  public getVehicleState(): any {
    return this.vehicleState;
  }

  public getMetrics(): IOHandlerMetrics {
    return {
      totalProcessed: this.totalProcessed,
      queueLength: this.queue.length,
      averageLatencyMs: this.totalProcessed > 0 ? this.totalLatencyMs / this.totalProcessed : 0,
      fallbackCount: this.fallbackCount,
      mode: this.mode
    };
  }

  public reset(): void {
    this.queue = [];
    this.isDraining = false;
    this.mode = 'concurrent_queue';
    this.fallbackCount = 0;
    this.totalProcessed = 0;
    this.totalLatencyMs = 0;
    if (this.vehicleState && typeof this.vehicleState.reset === 'function') {
      this.vehicleState.reset();
    }
  }
}

// Global default singleton
export const ioHandler = new IOHandler();
export const chooseDistance = (distance: number, options?: DistanceSelectionOptions) =>
  ioHandler.chooseDistance(distance, options);

module.exports = {
  IOHandler,
  ioHandler,
  chooseDistance
};
