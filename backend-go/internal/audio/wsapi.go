// Package audio provides HTTP SSE and REST telemetry endpoints for cross-runtime
// audio streaming between Go and the Electron/Node.js renderer.
package audio

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"sync/atomic"
	"time"
)

// ClientID represents a unique subscriber ID for audio streaming.
type ClientID uint64

// SSEClient manages an open Server-Sent Events stream connection to a client.
type SSEClient struct {
	id      ClientID
	w       http.ResponseWriter
	flusher http.Flusher
	done    chan struct{}
	mu      sync.Mutex
}

// AudioAPIServer exposes endpoints for real-time audio distribution and health metrics.
type AudioAPIServer struct {
	svc          *AudioService
	clients      map[ClientID]*SSEClient
	mu           sync.RWMutex
	nextID       atomic.Uint64
	maxClients   int
	bindAddr     string
	srv          *http.Server
	framesFwd    atomic.Uint64
	clientPeak   atomic.Uint64
	serverDone   chan struct{}
	cancelStream context.CancelFunc
}

// NewAudioAPIServer creates a new API server bound to the AudioService.
func NewAudioAPIServer(svc *AudioService, bindAddr string, maxClients int) *AudioAPIServer {
	if maxClients <= 0 {
		maxClients = 32
	}
	if bindAddr == "" {
		bindAddr = ":9090"
	}

	return &AudioAPIServer{
		svc:        svc,
		clients:    make(map[ClientID]*SSEClient),
		maxClients: maxClients,
		bindAddr:   bindAddr,
		serverDone: make(chan struct{}),
	}
}

// Start boots the HTTP listener and background frame consumption loop.
func (api *AudioAPIServer) Start(ctx context.Context) error {
	mux := http.NewServeMux()
	mux.HandleFunc("/audio/stream", api.handleStream)
	mux.HandleFunc("/audio/ingest", api.handleIngest)
	mux.HandleFunc("/audio/status", api.handleStatus)
	mux.HandleFunc("/audio/metrics/prometheus", api.handlePrometheus)

	api.srv = &http.Server{
		Addr:              api.bindAddr,
		Handler:           mux,
		ReadHeaderTimeout: 5 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	streamCtx, cancel := context.WithCancel(ctx)
	api.cancelStream = cancel
	go api.consumeFrames(streamCtx)

	go func() {
		defer close(api.serverDone)
		if err := api.srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			fmt.Printf("[AudioAPIServer] Listener error: %v\n", err)
		}
	}()

	return nil
}

// Stop terminates active client streams and shuts down the HTTP server.
func (api *AudioAPIServer) Stop(timeout time.Duration) error {
	if api.cancelStream != nil {
		api.cancelStream()
	}

	// Terminate active client streams
	api.mu.Lock()
	for _, client := range api.clients {
		select {
		case <-client.done:
		default:
			close(client.done)
		}
	}
	api.clients = make(map[ClientID]*SSEClient)
	api.mu.Unlock()

	if api.srv != nil {
		ctx, cancel := context.WithTimeout(context.Background(), timeout)
		defer cancel()
		return api.srv.Shutdown(ctx)
	}
	return nil
}

// handleStream upgrades an incoming connection to a Server-Sent Events stream.
func (api *AudioAPIServer) handleStream(w http.ResponseWriter, r *http.Request) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "Streaming unsupported", http.StatusInternalServerError)
		return
	}

	api.mu.Lock()
	if len(api.clients) >= api.maxClients {
		api.mu.Unlock()
		http.Error(w, "Maximum client capacity reached", http.StatusServiceUnavailable)
		return
	}

	clientID := ClientID(api.nextID.Add(1))
	client := &SSEClient{
		id:      clientID,
		w:       w,
		flusher: flusher,
		done:    make(chan struct{}),
	}
	api.clients[clientID] = client
	currClients := uint64(len(api.clients))
	api.mu.Unlock()

	for {
		peak := api.clientPeak.Load()
		if currClients <= peak {
			break
		}
		if api.clientPeak.CompareAndSwap(peak, currClients) {
			break
		}
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	flusher.Flush()

	select {
	case <-r.Context().Done():
	case <-client.done:
	}

	api.mu.Lock()
	delete(api.clients, clientID)
	api.mu.Unlock()
}

// handleIngest accepts raw PCM byte streams up to 64KB per request.
func (api *AudioAPIServer) handleIngest(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	defer r.Body.Close()
	data, err := io.ReadAll(io.LimitReader(r.Body, 65536))
	if err != nil || len(data) == 0 {
		http.Error(w, "Invalid or empty payload", http.StatusBadRequest)
		return
	}

	if err := api.svc.IngestFrame(data); err != nil {
		http.Error(w, err.Error(), http.StatusServiceUnavailable)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(`{"ok":true}`))
}

// handleStatus outputs composite service health, pipeline metrics, and bridge telemetry.
func (api *AudioAPIServer) handleStatus(w http.ResponseWriter, r *http.Request) {
	health := api.svc.HealthCheck()
	procMetrics := api.svc.Processor().GetMetrics()
	brMetrics := api.svc.Bridge().GetMetrics()

	api.mu.RLock()
	activeClients := len(api.clients)
	api.mu.RUnlock()

	resp := map[string]interface{}{
		"health":           health,
		"processorMetrics": procMetrics,
		"bridgeMetrics":    brMetrics,
		"activeClients":    activeClients,
		"clientPeak":       api.clientPeak.Load(),
		"framesForwarded":  api.framesFwd.Load(),
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(resp)
}

// handlePrometheus generates Prometheus text-format metrics.
func (api *AudioAPIServer) handlePrometheus(w http.ResponseWriter, r *http.Request) {
	health := api.svc.HealthCheck()
	brMetrics := api.svc.Bridge().GetMetrics()

	api.mu.RLock()
	activeClients := len(api.clients)
	api.mu.RUnlock()

	var sb strings.Builder
	sb.WriteString("# HELP eloquent_audio_service_frames_ingested_total Total frames ingested\n")
	sb.WriteString(fmt.Sprintf("eloquent_audio_service_frames_ingested_total %d\n", health.FramesIngested))

	sb.WriteString("# HELP eloquent_audio_service_frames_forwarded_total Total frames dispatched to SSE clients\n")
	sb.WriteString(fmt.Sprintf("eloquent_audio_service_frames_forwarded_total %d\n", api.framesFwd.Load()))

	sb.WriteString("# HELP eloquent_audio_service_active_clients Current active SSE listeners\n")
	sb.WriteString(fmt.Sprintf("eloquent_audio_service_active_clients %d\n", activeClients))

	sb.WriteString("# HELP eloquent_audio_service_drop_rate Pipeline input drop ratio\n")
	sb.WriteString(fmt.Sprintf("eloquent_audio_service_drop_rate %g\n", health.DropRate))

	sb.WriteString("# HELP eloquent_audio_bridge_contention_total Total flag contention events\n")
	sb.WriteString(fmt.Sprintf("eloquent_audio_bridge_contention_total %d\n", brMetrics.ContentionCount))

	sb.WriteString("# HELP eloquent_audio_bridge_align_fails_total Total pointer alignment assertion failures\n")
	sb.WriteString(fmt.Sprintf("eloquent_audio_bridge_align_fails_total %d\n", brMetrics.AlignmentFails))

	w.Header().Set("Content-Type", "text/plain; version=0.0.4; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(sb.String()))
}

// consumeFrames routes analyzed audio frames from the processor to active clients.
func (api *AudioAPIServer) consumeFrames(ctx context.Context) {
	outChan := api.svc.Processor().OutChan()
	for {
		select {
		case <-ctx.Done():
			return
		case frame, ok := <-outChan:
			if !ok {
				return
			}
			if frame != nil {
				api.broadcastFrame(frame)
				if frame.Data != nil {
					_ = api.svc.Processor().ReleaseBuffer(frame.Data)
				}
			}
		}
	}
}

// broadcastFrame sends serialized frame events to all active SSE subscribers non-blockingly.
func (api *AudioAPIServer) broadcastFrame(frame *ProcessedFrame) {
	data, err := json.Marshal(frame)
	if err != nil {
		return
	}

	payload := fmt.Sprintf("data: %s\n\n", string(data))

	api.mu.RLock()
	defer api.mu.RUnlock()

	for _, client := range api.clients {
		client.mu.Lock()
		_, err := client.w.Write([]byte(payload))
		if err == nil {
			client.flusher.Flush()
			api.framesFwd.Add(1)
		}
		client.mu.Unlock()
	}
}
