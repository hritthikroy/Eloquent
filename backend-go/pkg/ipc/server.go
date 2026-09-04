// Package ipc provides a high-throughput, low-latency HTTP/SSE IPC server
// facilitating bidirectional audio streaming and V-Sync clock synchronization between Electron and Go.
package ipc

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"eloquent-backend/pkg/audio"
)

// Common error definitions
var (
	ErrServerClosed       = errors.New("ipc server is closed")
	ErrMaxClientsExceeded = errors.New("maximum concurrent ipc clients exceeded")
	ErrEmptyIngestBody    = errors.New("ingest body cannot be empty")
)

// ClientID uniquely identifies an IPC streaming subscriber.
type ClientID uint64

// StreamClient represents an active real-time audio streaming connection.
type StreamClient struct {
	ID       ClientID
	Format   string
	Writer   http.ResponseWriter
	Flusher  http.Flusher
	Done     chan struct{}
	OutQueue chan []byte
	isClosed atomic.Bool
}

// IPCStatus represents the health and synchronization status payload.
type IPCStatus struct {
	UptimeSeconds    float64            `json:"uptimeSeconds"`
	ActiveClients    int                `json:"activeClients"`
	MaxClients       int                `json:"maxClients"`
	IngestedFrames   uint64             `json:"ingestedFrames"`
	ProcessedFrames  uint64             `json:"processedFrames"`
	DroppedFrames    uint64             `json:"droppedFrames"`
	ClockDriftUs     int64              `json:"clockDriftUs"`
	SyncState        audio.SyncState    `json:"syncState"`
	DriftCorrections uint64             `json:"driftCorrections"`
	IsConnected      bool               `json:"isConnected"`
	IsHealthy        bool               `json:"isHealthy"`
	EngineMetrics    audio.EngineMetrics `json:"engineMetrics"`
}

// SyncRequest represents the visual timestamp sync payload from Electron.
type SyncRequest struct {
	VisualTimestampNs int64   `json:"visualTimestampNs"`
	TargetFPS         float64 `json:"targetFps"`
}

// SyncResponse returns real-time clock drift feedback to the renderer.
type SyncResponse struct {
	OK           bool            `json:"ok"`
	ClockDriftUs int64           `json:"clockDriftUs"`
	SyncState    audio.SyncState `json:"syncState"`
	TimestampNs  int64           `json:"timestampNs"`
}

// IPCServer manages HTTP and streaming endpoints for Electron-Go audio IPC.
type IPCServer struct {
	engine        *audio.AudioEngine
	registry      *audio.CodecRegistry
	bindAddr      string
	maxClients    int
	srv           *http.Server
	listener      net.Listener
	mu            sync.RWMutex
	clients       map[ClientID]*StreamClient
	nextClientID  atomic.Uint64
	frameIDGen    atomic.Uint64
	startTime     time.Time
	isClosed      atomic.Bool
	stopChan      chan struct{}
	drainWg       sync.WaitGroup
	framesFwd     atomic.Uint64
	bytesFwd      atomic.Uint64
}

// NewIPCServer initializes the IPC server with the provided engine, codec registry, and network bind address.
func NewIPCServer(engine *audio.AudioEngine, registry *audio.CodecRegistry, bindAddr string, maxClients int) *IPCServer {
	if maxClients <= 0 {
		maxClients = 64
	}
	if registry == nil {
		registry = audio.DefaultCodecRegistry()
	}

	s := &IPCServer{
		engine:       engine,
		registry:     registry,
		bindAddr:     bindAddr,
		maxClients:   maxClients,
		clients:      make(map[ClientID]*StreamClient),
		startTime:    time.Now(),
		stopChan:     make(chan struct{}),
	}

	// Register subscriber callback on AudioEngine to broadcast to streaming clients
	if engine != nil {
		engine.Subscribe(s.broadcastFrame)
	}

	return s
}

// Handler builds and returns the http.Handler for IPC endpoints.
func (s *IPCServer) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/audio/stream", s.handleStream)
	mux.HandleFunc("/audio/ingest", s.handleIngest)
	mux.HandleFunc("/audio/sync", s.handleSync)
	mux.HandleFunc("/audio/status", s.handleStatus)
	mux.HandleFunc("/audio/metrics/prometheus", s.handlePrometheus)
	return mux
}

// Start boots the HTTP listener and starts servicing incoming requests.
func (s *IPCServer) Start() error {
	if s.isClosed.Load() {
		return ErrServerClosed
	}

	listener, err := net.Listen("tcp", s.bindAddr)
	if err != nil {
		return fmt.Errorf("failed to bind IPC listener to %s: %w", s.bindAddr, err)
	}
	s.listener = listener

	s.srv = &http.Server{
		Handler:      s.Handler(),
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 0, // Infinite for persistent streaming connections
		IdleTimeout:  60 * time.Second,
	}

	s.drainWg.Add(1)
	go func() {
		defer s.drainWg.Done()
		_ = s.srv.Serve(listener)
	}()

	return nil
}

// Addr returns the actual bound network address string.
func (s *IPCServer) Addr() string {
	if s.listener != nil {
		return s.listener.Addr().String()
	}
	return s.bindAddr
}

// Stop gracefully shuts down the HTTP server and disconnects active streaming subscribers.
func (s *IPCServer) Stop(timeout time.Duration) error {
	if !s.isClosed.CompareAndSwap(false, true) {
		return nil
	}

	close(s.stopChan)

	// Disconnect all active streaming clients
	s.mu.Lock()
	for _, client := range s.clients {
		if client.isClosed.CompareAndSwap(false, true) {
			close(client.Done)
		}
	}
	s.clients = make(map[ClientID]*StreamClient)
	s.mu.Unlock()

	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	var err error
	if s.srv != nil {
		err = s.srv.Shutdown(ctx)
	}

	s.drainWg.Wait()
	return err
}

// ─────────────────────────────────────────────────────────────────────────────
// HTTP Handlers
// ─────────────────────────────────────────────────────────────────────────────

// handleStream services persistent GET /audio/stream requests (SSE or binary chunks).
func (s *IPCServer) handleStream(w http.ResponseWriter, r *http.Request) {
	if s.isClosed.Load() {
		http.Error(w, "server closing", http.StatusServiceUnavailable)
		return
	}

	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "streaming unsupported by client connection", http.StatusBadRequest)
		return
	}

	s.mu.RLock()
	clientCount := len(s.clients)
	s.mu.RUnlock()

	if clientCount >= s.maxClients {
		http.Error(w, "max stream clients reached", http.StatusServiceUnavailable)
		return
	}

	format := strings.ToLower(r.URL.Query().Get("format"))
	if format == "" {
		if strings.Contains(r.Header.Get("Accept"), "text/event-stream") {
			format = "sse"
		} else {
			format = "elq1"
		}
	}

	clientID := ClientID(s.nextClientID.Add(1))
	client := &StreamClient{
		ID:       clientID,
		Format:   format,
		Writer:   w,
		Flusher:  flusher,
		Done:     make(chan struct{}),
		OutQueue: make(chan []byte, 128),
	}

	s.mu.Lock()
	s.clients[clientID] = client
	s.mu.Unlock()

	defer func() {
		s.mu.Lock()
		delete(s.clients, clientID)
		s.mu.Unlock()
		if client.isClosed.CompareAndSwap(false, true) {
			close(client.Done)
		}
	}()

	// Set appropriate streaming headers
	if format == "sse" {
		w.Header().Set("Content-Type", "text/event-stream")
		w.Header().Set("Cache-Control", "no-cache")
		w.Header().Set("Connection", "keep-alive")
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.WriteHeader(http.StatusOK)
		_, _ = fmt.Fprintf(w, "event: connected\ndata: {\"clientId\":%d,\"format\":\"sse\"}\n\n", clientID)
		flusher.Flush()
	} else {
		w.Header().Set("Content-Type", "application/octet-stream")
		w.Header().Set("Cache-Control", "no-cache")
		w.Header().Set("Connection", "keep-alive")
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.WriteHeader(http.StatusOK)
		flusher.Flush()
	}

	// Streaming pump loop
	notifyCtx := r.Context().Done()
	for {
		select {
		case <-s.stopChan:
			return
		case <-notifyCtx:
			return
		case <-client.Done:
			return
		case payload, ok := <-client.OutQueue:
			if !ok {
				return
			}
			var writeErr error
			if format == "sse" {
				_, writeErr = fmt.Fprintf(w, "data: %s\n\n", string(payload))
			} else {
				_, writeErr = w.Write(payload)
			}
			if writeErr != nil {
				return
			}
			flusher.Flush()
			s.framesFwd.Add(1)
			s.bytesFwd.Add(uint64(len(payload)))
		}
	}
}

// handleIngest processes POST /audio/ingest containing raw PCM audio buffers.
func (s *IPCServer) handleIngest(w http.ResponseWriter, r *http.Request) {
	if s.isClosed.Load() {
		http.Error(w, "server closed", http.StatusServiceUnavailable)
		return
	}
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Limit to 64KB per frame chunk to prevent memory abuse
	limitedBody := io.LimitReader(r.Body, 64*1024)
	data, err := io.ReadAll(limitedBody)
	if err != nil {
		http.Error(w, fmt.Sprintf("read failed: %v", err), http.StatusBadRequest)
		return
	}
	if len(data) == 0 {
		http.Error(w, "empty audio payload", http.StatusBadRequest)
		return
	}

	frameID := s.frameIDGen.Add(1)
	if s.engine != nil {
		ok, submitErr := s.engine.Submit(data, frameID)
		if submitErr != nil || !ok {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusServiceUnavailable)
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"ok":    false,
				"error": fmt.Sprintf("%v", submitErr),
			})
			return
		}
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"ok":            true,
		"frameId":       frameID,
		"ingestedBytes": len(data),
	})
}

// handleSync processes POST /audio/sync clock synchronization heartbeats.
func (s *IPCServer) handleSync(w http.ResponseWriter, r *http.Request) {
	if s.isClosed.Load() {
		http.Error(w, "server closed", http.StatusServiceUnavailable)
		return
	}

	var req SyncRequest
	if r.Body != nil {
		_ = json.NewDecoder(r.Body).Decode(&req)
	}

	nowNs := time.Now().UnixNano()
	vts := req.VisualTimestampNs
	if vts <= 0 {
		vts = nowNs
	}

	var drift int64
	state := audio.SyncStateInSync

	if s.engine != nil {
		s.engine.Heartbeat()
		if syncer := s.engine.Synchronizer(); syncer != nil {
			syncer.RecordVisualFrame(vts)
			drift = syncer.GetDriftUs()
			state = syncer.GetState()
		}
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(SyncResponse{
		OK:           true,
		ClockDriftUs: drift,
		SyncState:    state,
		TimestampNs:  nowNs,
	})
}

// handleStatus returns complete JSON status and engine telemetry.
func (s *IPCServer) handleStatus(w http.ResponseWriter, r *http.Request) {
	s.mu.RLock()
	clientCount := len(s.clients)
	s.mu.RUnlock()

	var engMetrics audio.EngineMetrics
	var isConnected, isHealthy bool
	var driftUs int64
	syncState := audio.SyncStateInSync
	var corrections uint64

	if s.engine != nil {
		engMetrics = s.engine.GetMetrics()
		isConnected = s.engine.IsConnected()
		isHealthy = engMetrics.IsHealthy
		driftUs = engMetrics.ClockDriftUs
		syncState = engMetrics.SyncState
		corrections = engMetrics.DriftCorrections
	}

	status := IPCStatus{
		UptimeSeconds:    time.Since(s.startTime).Seconds(),
		ActiveClients:    clientCount,
		MaxClients:       s.maxClients,
		IngestedFrames:   engMetrics.FramesIngested,
		ProcessedFrames:  engMetrics.FramesProcessed,
		DroppedFrames:    engMetrics.FramesDropped,
		ClockDriftUs:     driftUs,
		SyncState:        syncState,
		DriftCorrections: corrections,
		IsConnected:      isConnected,
		IsHealthy:        isHealthy,
		EngineMetrics:    engMetrics,
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(status)
}

// handlePrometheus emits Prometheus metrics text format for observability.
func (s *IPCServer) handlePrometheus(w http.ResponseWriter, r *http.Request) {
	s.mu.RLock()
	clientCount := len(s.clients)
	s.mu.RUnlock()

	var m audio.EngineMetrics
	if s.engine != nil {
		m = s.engine.GetMetrics()
	}

	w.Header().Set("Content-Type", "text/plain; version=0.0.4")
	fmt.Fprintf(w, "# HELP eloquent_audio_frames_ingested_total Total audio frames ingested\n")
	fmt.Fprintf(w, "# TYPE eloquent_audio_frames_ingested_total counter\n")
	fmt.Fprintf(w, "eloquent_audio_frames_ingested_total %d\n", m.FramesIngested)

	fmt.Fprintf(w, "# HELP eloquent_audio_frames_processed_total Total audio frames processed\n")
	fmt.Fprintf(w, "# TYPE eloquent_audio_frames_processed_total counter\n")
	fmt.Fprintf(w, "eloquent_audio_frames_processed_total %d\n", m.FramesProcessed)

	fmt.Fprintf(w, "# HELP eloquent_audio_frames_dropped_total Total frames dropped\n")
	fmt.Fprintf(w, "# TYPE eloquent_audio_frames_dropped_total counter\n")
	fmt.Fprintf(w, "eloquent_audio_frames_dropped_total %d\n", m.FramesDropped)

	fmt.Fprintf(w, "# HELP eloquent_audio_active_clients Current active IPC stream clients\n")
	fmt.Fprintf(w, "# TYPE eloquent_audio_active_clients gauge\n")
	fmt.Fprintf(w, "eloquent_audio_active_clients %d\n", clientCount)

	fmt.Fprintf(w, "# HELP eloquent_audio_clock_drift_us Current clock drift in microseconds\n")
	fmt.Fprintf(w, "# TYPE eloquent_audio_clock_drift_us gauge\n")
	fmt.Fprintf(w, "eloquent_audio_clock_drift_us %d\n", m.ClockDriftUs)
}

// broadcastFrame serializes and queues an AudioFrame to all active streaming clients.
func (s *IPCServer) broadcastFrame(frame *audio.AudioFrame) {
	if frame == nil || s.isClosed.Load() {
		return
	}

	s.mu.RLock()
	defer s.mu.RUnlock()

	if len(s.clients) == 0 {
		return
	}

	// Cache encoded formats for this frame to avoid redundant encoding per client
	encodedCache := make(map[string][]byte)

	for _, client := range s.clients {
		format := client.Format
		payload, cached := encodedCache[format]
		if !cached {
			if format == "sse" {
				// Encode frame as JSON
				if jsonBytes, err := json.Marshal(frame); err == nil {
					payload = jsonBytes
				}
			} else if s.registry != nil {
				if codec, ok := s.registry.Get(format); ok {
					if encBytes, err := codec.Encode(frame); err == nil {
						payload = encBytes
					}
				}
			}
			encodedCache[format] = payload
		}

		if len(payload) > 0 {
			select {
			case client.OutQueue <- payload:
			default:
				// If client buffer is full, drop frame to maintain zero stall
			}
		}
	}
}
