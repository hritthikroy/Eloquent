// Package state provides core Go audio processing engine, stream management,
// buffer allocation with lock-free recycling, and fault-tolerant disconnection recovery.
package state

import (
	"context"
	"errors"
	"sync"
	"sync/atomic"
	"time"
)

var (
	// ErrEngineNotRunning indicates an operation attempted on a stopped audio engine.
	ErrEngineNotRunning = errors.New("audio engine is not running")
	// ErrDeviceDisconnected indicates ingestion attempted while audio hardware is unplugged.
	ErrDeviceDisconnected = errors.New("audio device is disconnected")
	// ErrBufferLimitExceeded indicates buffer allocation cap reached under backpressure.
	ErrBufferLimitExceeded = errors.New("maximum buffer allocation limit exceeded")
)

// AudioEngineConfig defines operating limits and device parameters.
type AudioEngineConfig struct {
	SampleRate          int           `json:"sampleRate"`
	Channels            int           `json:"channels"`
	BufferSize          int           `json:"bufferSize"`
	MaxAllocatedBuffers int           `json:"maxAllocatedBuffers"`
	HeartbeatTimeout    time.Duration `json:"heartbeatTimeout"`
}

// AudioEngineMetrics tracks lock-free operational health and buffer statistics.
type AudioEngineMetrics struct {
	FramesIngested  uint64 `json:"framesIngested"`
	FramesProcessed uint64 `json:"framesProcessed"`
	FramesDropped   uint64 `json:"framesDropped"`
	OverrunCount    uint64 `json:"overrunCount"`
	UnderrunCount   uint64 `json:"underrunCount"`
	ActiveBuffers   int64  `json:"activeBuffers"`
	IsDeviceActive  bool   `json:"isDeviceActive"`
	IsConnected     bool   `json:"isConnected"`
	DeviceName      string `json:"deviceName"`
	LastHeartbeatMs int64  `json:"lastHeartbeatMs"`
}

// AudioEngine manages low-latency stream processing, buffer recycling, and hardware fault tolerance.
type AudioEngine struct {
	mu             sync.RWMutex
	config         AudioEngineConfig
	running        bool
	ctx            context.Context
	cancel         context.CancelFunc
	sessionManager *SessionManager

	// Lock-free buffer recycling pool
	bufferPool    sync.Pool
	activeBuffers atomic.Int64

	// Hardware and IPC connection status flags
	deviceActive atomic.Bool
	connected    atomic.Bool
	deviceName   string

	// Counters and metrics
	framesIngested  atomic.Uint64
	framesProcessed atomic.Uint64
	framesDropped   atomic.Uint64
	overrunCount    atomic.Uint64
	underrunCount   atomic.Uint64
	lastHeartbeatMs atomic.Int64

	// Internal processing queue
	frameQueue chan []byte

	// Event-driven state synchronization
	stateMu          sync.RWMutex
	stateSubscribers map[int64]StateSyncListener
	nextSubscriberID int64
	lastStateEvent   StateSyncEvent
}

// NewAudioEngine initializes an AudioEngine with the specified configuration and session manager.
func NewAudioEngine(config AudioEngineConfig, sessionMgr *SessionManager) *AudioEngine {
	if config.SampleRate <= 0 {
		config.SampleRate = 48000
	}
	if config.Channels <= 0 {
		config.Channels = 1
	}
	if config.BufferSize <= 0 {
		config.BufferSize = 4096
	}
	if config.MaxAllocatedBuffers <= 0 {
		config.MaxAllocatedBuffers = 256
	}
	if config.HeartbeatTimeout <= 0 {
		config.HeartbeatTimeout = 2500 * time.Millisecond
	}

	engine := &AudioEngine{
		config:           config,
		sessionManager:   sessionMgr,
		deviceName:       "default",
		frameQueue:       make(chan []byte, config.MaxAllocatedBuffers),
		stateSubscribers: make(map[int64]StateSyncListener),
		lastStateEvent: StateSyncEvent{
			EventType:   "STATE_INITIALIZED",
			State:       "IDLE",
			Speed:       0.0,
			Distance:    0.0,
			TimestampMs: time.Now().UnixMilli(),
		},
	}

	engine.bufferPool = sync.Pool{
		New: func() interface{} {
			engine.activeBuffers.Add(1)
			b := make([]byte, config.BufferSize)
			return b
		},
	}

	engine.deviceActive.Store(true)
	engine.connected.Store(true)
	engine.lastHeartbeatMs.Store(time.Now().UnixMilli())

	return engine
}

// Start begins the audio processing worker and heartbeat monitor loops.
func (ae *AudioEngine) Start(ctx context.Context) error {
	ae.mu.Lock()
	if ae.running {
		ae.mu.Unlock()
		return nil
	}

	ae.ctx, ae.cancel = context.WithCancel(ctx)
	ae.running = true
	ae.mu.Unlock()

	// Update session audio state if session manager provided
	if ae.sessionManager != nil {
		ae.sessionManager.SetAudioStreamState(AudioStreamCapturing)
	}

	// Worker loop: processes queued PCM frames
	go ae.processLoop()

	// Monitor loop: checks for IPC heartbeat drop
	go ae.heartbeatMonitorLoop()

	return nil
}

// Stop cleanly terminates processing workers and releases buffered resources.
func (ae *AudioEngine) Stop() error {
	ae.mu.Lock()
	if !ae.running {
		ae.mu.Unlock()
		return nil
	}

	if ae.cancel != nil {
		ae.cancel()
	}
	ae.running = false
	ae.mu.Unlock()

	if ae.sessionManager != nil {
		ae.sessionManager.SetAudioStreamState(AudioStreamInactive)
	}

	ae.Drain()
	return nil
}

// Reset flushes all queues and resets diagnostic counters.
func (ae *AudioEngine) Reset() {
	ae.Drain()
	ae.framesIngested.Store(0)
	ae.framesProcessed.Store(0)
	ae.framesDropped.Store(0)
	ae.overrunCount.Store(0)
	ae.underrunCount.Store(0)
	ae.lastHeartbeatMs.Store(time.Now().UnixMilli())
	ae.deviceActive.Store(true)
	ae.connected.Store(true)
}

// IngestFrame accepts a raw audio PCM packet, validates device availability,
// and enqueues the frame using pooled buffer memory.
func (ae *AudioEngine) IngestFrame(pcmData []byte) error {
	if !ae.deviceActive.Load() {
		ae.framesDropped.Add(1)
		return ErrDeviceDisconnected
	}

	ae.mu.RLock()
	running := ae.running
	ae.mu.RUnlock()

	if !running {
		return ErrEngineNotRunning
	}

	ae.framesIngested.Add(1)

	// Acquire pooled buffer
	buf := ae.GetBuffer()
	copyLen := len(pcmData)
	if copyLen > len(buf) {
		copyLen = len(buf)
	}
	copy(buf[:copyLen], pcmData[:copyLen])

	select {
	case ae.frameQueue <- buf[:copyLen]:
		return nil
	default:
		// Queue full - adaptive backpressure drops frame and recycles buffer
		ae.overrunCount.Add(1)
		ae.framesDropped.Add(1)
		ae.ReleaseBuffer(buf)
		return ErrBufferLimitExceeded
	}
}

// GetBuffer retrieves a reusable byte buffer from the pool.
func (ae *AudioEngine) GetBuffer() []byte {
	return ae.bufferPool.Get().([]byte)
}

// ReleaseBuffer returns a byte buffer to the pool for reuse, avoiding GC allocations.
func (ae *AudioEngine) ReleaseBuffer(buf []byte) {
	if buf == nil {
		return
	}
	// Re-slice to capacity if needed
	if cap(buf) >= ae.config.BufferSize {
		ae.bufferPool.Put(buf[:ae.config.BufferSize])
	}
}

// Drain empties the frame queue and returns the count of drained frames.
func (ae *AudioEngine) Drain() int {
	drained := 0
	for {
		select {
		case buf := <-ae.frameQueue:
			ae.ReleaseBuffer(buf)
			drained++
		default:
			return drained
		}
	}
}

// OnDeviceDisconnected safely handles physical audio device unplugging or CoreAudio device loss.
func (ae *AudioEngine) OnDeviceDisconnected() {
	ae.deviceActive.Store(false)
	if ae.sessionManager != nil {
		ae.sessionManager.SetAudioStreamState(AudioStreamInactive)
	}
	ae.Drain()
}

// OnDeviceReconnected re-enables frame ingestion after audio hardware is restored.
func (ae *AudioEngine) OnDeviceReconnected(deviceName string) {
	ae.mu.Lock()
	if deviceName != "" {
		ae.deviceName = deviceName
	}
	ae.mu.Unlock()

	ae.deviceActive.Store(true)
	if ae.sessionManager != nil {
		ae.sessionManager.SetAudioStreamState(AudioStreamCapturing)
	}
}

// ReceiveHeartbeat records a keep-alive ping from the Electron IPC layer.
func (ae *AudioEngine) ReceiveHeartbeat() int64 {
	now := time.Now().UnixMilli()
	ae.lastHeartbeatMs.Store(now)
	ae.connected.Store(true)
	return now
}

// OnIPCDrop handles an unexpected communication channel drop from Electron frontend.
func (ae *AudioEngine) OnIPCDrop() {
	ae.connected.Store(false)
	ae.underrunCount.Add(1)
	ae.Drain()
}

// GetMetrics returns snapshot telemetry of engine throughput and health.
func (ae *AudioEngine) GetMetrics() AudioEngineMetrics {
	ae.mu.RLock()
	devName := ae.deviceName
	ae.mu.RUnlock()

	return AudioEngineMetrics{
		FramesIngested:  ae.framesIngested.Load(),
		FramesProcessed: ae.framesProcessed.Load(),
		FramesDropped:   ae.framesDropped.Load(),
		OverrunCount:    ae.overrunCount.Load(),
		UnderrunCount:   ae.underrunCount.Load(),
		ActiveBuffers:   ae.activeBuffers.Load(),
		IsDeviceActive:  ae.deviceActive.Load(),
		IsConnected:     ae.connected.Load(),
		DeviceName:      devName,
		LastHeartbeatMs: ae.lastHeartbeatMs.Load(),
	}
}

// IsConnected returns true if IPC heartbeats are active.
func (ae *AudioEngine) IsConnected() bool {
	return ae.connected.Load()
}

// IsDeviceActive returns true if hardware audio stream is active.
func (ae *AudioEngine) IsDeviceActive() bool {
	return ae.deviceActive.Load()
}

func (ae *AudioEngine) processLoop() {
	for {
		select {
		case <-ae.ctx.Done():
			return
		case buf, ok := <-ae.frameQueue:
			if !ok {
				return
			}
			// Simulate sub-millisecond DSP / energy calculation
			ae.framesProcessed.Add(1)
			ae.ReleaseBuffer(buf)
		}
	}
}

func (ae *AudioEngine) heartbeatMonitorLoop() {
	ticker := time.NewTicker(200 * time.Millisecond)
	defer ticker.Stop()

	for {
		select {
		case <-ae.ctx.Done():
			return
		case <-ticker.C:
			last := ae.lastHeartbeatMs.Load()
			elapsed := time.Duration(time.Now().UnixMilli()-last) * time.Millisecond
			if elapsed > ae.config.HeartbeatTimeout {
				if ae.connected.Load() {
					ae.OnIPCDrop()
				}
			}
		}
	}
}

// StateSyncEvent represents an event-driven state synchronization message.
type StateSyncEvent struct {
	EventType   string                 `json:"eventType"`
	State       string                 `json:"state"`
	Speed       float64                `json:"speed"`
	Distance    float64                `json:"distance"`
	TimestampMs int64                  `json:"timestampMs"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
}

// StateSyncListener defines the callback for event-driven updates.
type StateSyncListener func(event StateSyncEvent)

// StateSyncRequest represents a lightweight gRPC sync request payload.
type StateSyncRequest struct {
	TargetState string  `json:"targetState"`
	Speed       float64 `json:"speed"`
	Distance    float64 `json:"distance"`
	ClientID    string  `json:"clientId"`
}

// StateSyncResponse represents a lightweight gRPC sync response payload.
type StateSyncResponse struct {
	Success   bool           `json:"success"`
	State     string         `json:"state"`
	Speed     float64        `json:"speed"`
	LatencyMs float64        `json:"latencyMs"`
	Event     StateSyncEvent `json:"event"`
}

// AudioStateSyncServer defines the lightweight event-driven gRPC/RPC interface.
type AudioStateSyncServer interface {
	SyncState(ctx context.Context, req *StateSyncRequest) (*StateSyncResponse, error)
	StreamStateUpdates(req *StateSyncRequest, stream chan<- StateSyncEvent) error
}

// SubscribeState registers an event-driven listener, returning an unsubscribe function.
func (ae *AudioEngine) SubscribeState(listener StateSyncListener) func() {
	ae.stateMu.Lock()
	defer ae.stateMu.Unlock()

	ae.nextSubscriberID++
	id := ae.nextSubscriberID
	ae.stateSubscribers[id] = listener

	return func() {
		ae.stateMu.Lock()
		defer ae.stateMu.Unlock()
		delete(ae.stateSubscribers, id)
	}
}

// PublishStateUpdate broadcasts state updates to all active subscribers with zero polling latency.
func (ae *AudioEngine) PublishStateUpdate(event StateSyncEvent) {
	if event.TimestampMs == 0 {
		event.TimestampMs = time.Now().UnixMilli()
	}

	// Dynamically adjust audio buffer size according to vehicle speed state
	ae.SetDynamicBufferForSpeed(event.State, event.Speed)

	ae.stateMu.Lock()
	ae.lastStateEvent = event
	subscribers := make([]StateSyncListener, 0, len(ae.stateSubscribers))
	for _, sub := range ae.stateSubscribers {
		subscribers = append(subscribers, sub)
	}
	ae.stateMu.Unlock()

	// Deliver to subscribers without holding stateMu lock
	for _, sub := range subscribers {
		sub(event)
	}
}

// SetDynamicBufferForSpeed adjusts buffer size dynamically based on vehicle speed and state.
// High speed (speed >= 60 or CRUISING) -> 1024 bytes (ultra-low latency ~5-10ms)
// Moderate speed (25 <= speed < 60 or ACCELERATING/DECELERATING) -> 2048 bytes (~20ms)
// Stopped / Low speed (speed < 25 or STOPPED/IDLE) -> 4096 bytes (power-efficient baseline)
func (ae *AudioEngine) SetDynamicBufferForSpeed(state string, speed float64) int {
	targetSize := 4096

	if speed >= 60.0 || state == "CRUISING" {
		targetSize = 1024
	} else if speed >= 25.0 || state == "ACCELERATING" || state == "DECELERATING" {
		targetSize = 2048
	} else {
		targetSize = 4096
	}

	ae.mu.Lock()
	defer ae.mu.Unlock()

	if ae.config.BufferSize != targetSize {
		ae.config.BufferSize = targetSize
	}
	return targetSize
}

// GetBufferSize returns the current active audio buffer size.
func (ae *AudioEngine) GetBufferSize() int {
	ae.mu.RLock()
	defer ae.mu.RUnlock()
	return ae.config.BufferSize
}

// GetLatestState returns the latest cached state synchronization event.
func (ae *AudioEngine) GetLatestState() StateSyncEvent {
	ae.stateMu.RLock()
	defer ae.stateMu.RUnlock()
	return ae.lastStateEvent
}

// SyncState implements the lightweight gRPC/RPC state sync service.
func (ae *AudioEngine) SyncState(ctx context.Context, req *StateSyncRequest) (*StateSyncResponse, error) {
	start := time.Now()

	event := StateSyncEvent{
		EventType:   "STATE_TRANSITION",
		State:       req.TargetState,
		Speed:       req.Speed,
		Distance:    req.Distance,
		TimestampMs: time.Now().UnixMilli(),
		Metadata: map[string]interface{}{
			"clientId": req.ClientID,
		},
	}

	ae.PublishStateUpdate(event)
	latency := float64(time.Since(start).Microseconds()) / 1000.0

	return &StateSyncResponse{
		Success:   true,
		State:     req.TargetState,
		Speed:     req.Speed,
		LatencyMs: latency,
		Event:     event,
	}, nil
}

// StreamStateUpdates streams event-driven state transitions to a channel.
func (ae *AudioEngine) StreamStateUpdates(req *StateSyncRequest, stream chan<- StateSyncEvent) error {
	ae.SubscribeState(func(evt StateSyncEvent) {
		select {
		case stream <- evt:
		default:
		}
	})
	return nil
}
