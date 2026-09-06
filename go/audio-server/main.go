// Package main provides the standalone Eloquent Audio Server daemon with
// context-aware shutdown handling, pipeline draining, and socket cleanup.
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"sync"
	"sync/atomic"
	"syscall"
	"time"
)

// PipelineConfig defines audio pipeline configuration parameters.
type PipelineConfig struct {
	SampleRate int
	Channels   int
	BufferSize int
}

// AudioPipeline simulates and controls the low-latency audio processing pipeline.
type AudioPipeline struct {
	config      PipelineConfig
	isRunning   atomic.Bool
	framesQueue chan []byte
	closed      chan struct{}
	mu          sync.Mutex
	openFDs     []*os.File
}

// NewAudioPipeline initializes an active audio processing pipeline.
func NewAudioPipeline(cfg PipelineConfig) *AudioPipeline {
	if cfg.SampleRate <= 0 {
		cfg.SampleRate = 48000
	}
	if cfg.Channels <= 0 {
		cfg.Channels = 1
	}
	if cfg.BufferSize <= 0 {
		cfg.BufferSize = 1024
	}

	p := &AudioPipeline{
		config:      cfg,
		framesQueue: make(chan []byte, cfg.BufferSize),
		closed:      make(chan struct{}),
		openFDs:     make([]*os.File, 0),
	}
	p.isRunning.Store(true)

	// Background worker simulating audio stream ingestion
	go p.workerLoop()

	return p
}

func (p *AudioPipeline) workerLoop() {
	for {
		select {
		case <-p.closed:
			return
		case _, ok := <-p.framesQueue:
			if !ok {
				return
			}
		}
	}
}

// Stop gracefully drains the audio processing pipeline and closes all tracked file descriptors.
func (p *AudioPipeline) Stop(ctx context.Context) error {
	p.mu.Lock()
	defer p.mu.Unlock()

	if !p.isRunning.Swap(false) {
		return nil
	}

	log.Println("[audio-server] 🎙️  Stopping audio pipeline worker and draining frames...")
	close(p.closed)

	// Drain remaining frames with timeout
	drainDone := make(chan struct{})
	go func() {
		for len(p.framesQueue) > 0 {
			<-p.framesQueue
		}
		close(drainDone)
	}()

	select {
	case <-drainDone:
		log.Println("[audio-server] ✅ Audio frame queue drained successfully.")
	case <-ctx.Done():
		log.Println("[audio-server] ⚠️ Timeout reached while draining audio frame queue.")
	}

	// Close tracked open file descriptors
	for _, f := range p.openFDs {
		if f != nil {
			_ = f.Close()
		}
	}
	p.openFDs = nil

	return nil
}

func main() {
	log.Println("[audio-server] 🚀 Starting Eloquent Audio Server...")

	// 1. Root context intercepted by OS signals (SIGTERM & SIGINT)
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	// 2. Initialize Audio Pipeline
	pipeline := NewAudioPipeline(PipelineConfig{
		SampleRate: 48000,
		Channels:   1,
		BufferSize: 2048,
	})

	// 3. Configure HTTP Server
	port := os.Getenv("AUDIO_SERVER_PORT")
	if port == "" {
		port = "9092"
	}
	addr := fmt.Sprintf("127.0.0.1:%s", port)

	mux := http.NewServeMux()

	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"status":   "ok",
			"running":  pipeline.isRunning.Load(),
			"service":  "eloquent-audio-server",
			"pid":      os.Getpid(),
			"endpoint": addr,
		})
	})

	mux.HandleFunc("/audio/status", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"active":     pipeline.isRunning.Load(),
			"queueDepth": len(pipeline.framesQueue),
			"timestamp":  time.Now().UnixMilli(),
		})
	})

	mux.HandleFunc("/shutdown", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
			return
		}
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"status":"shutting_down"}`))
		go func() {
			time.Sleep(50 * time.Millisecond)
			stop()
		}()
	})

	server := &http.Server{
		Addr:    addr,
		Handler: mux,
		BaseContext: func(_ net.Listener) context.Context {
			return ctx
		},
	}

	// 4. Start HTTP listener in background goroutine
	serverErr := make(chan error, 1)
	go func() {
		log.Printf("[audio-server] 📡 HTTP Socket listening on http://%s", addr)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			serverErr <- err
		}
		close(serverErr)
	}()

	// 5. Block until SIGTERM / SIGINT or Server Error
	select {
	case err := <-serverErr:
		if err != nil {
			log.Fatalf("[audio-server] ❌ Server listen error: %v", err)
		}
	case <-ctx.Done():
		log.Println("[audio-server] 🛑 SIGTERM/SIGINT received. Initiating graceful shutdown handler...")
	}

	// 6. Graceful teardown protocol with 2-second timeout
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	// Drain and stop audio pipeline
	if err := pipeline.Stop(shutdownCtx); err != nil {
		log.Printf("[audio-server] ⚠️ Pipeline stop warning: %v", err)
	}

	// Close network sockets and await pending HTTP connections
	log.Println("[audio-server] 🔌 Closing network sockets and shutting down HTTP listener...")
	if err := server.Shutdown(shutdownCtx); err != nil {
		log.Printf("[audio-server] ⚠️ HTTP shutdown warning: %v", err)
		_ = server.Close()
	}

	log.Println("[audio-server] ✅ Eloquent Audio Server gracefully shut down. Exiting cleanly.")
}
