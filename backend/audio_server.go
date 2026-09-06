package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"hash/crc32"
	"io"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"syscall"
	"time"
)

// AudioStatus represents the structured JSON response emitted back to the Electron Node.js process.
type AudioStatus struct {
	Status         string  `json:"status"` // "ok" | "error"
	LatencyMs      float64 `json:"latency_ms"`
	Message        string  `json:"message,omitempty"`
	BytesReceived  int     `json:"bytes_received,omitempty"`
	SequenceNumber int64   `json:"sequence_number,omitempty"`
	Timestamp      int64   `json:"timestamp,omitempty"`
}

// AudioServer encapsulates the HTTP and streaming server for audio frame ingestion.
type AudioServer struct {
	port           int
	host           string
	mu             sync.RWMutex
	framesIngested int64
	bytesIngested  int64
	lastLatencyMs  float64
	server         *http.Server
	startedAt      time.Time
}

// NewAudioServer instantiates a new AudioServer.
func NewAudioServer(host string, port int) *AudioServer {
	return &AudioServer{
		host:      host,
		port:      port,
		startedAt: time.Now(),
	}
}

// Routes sets up the HTTP router for audio ingestion and diagnostics.
func (s *AudioServer) Routes() http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("/health", s.handleHealth)
	mux.HandleFunc("/audio/chunk", s.handleAudioChunk)
	mux.HandleFunc("/audio/status", s.handleStatus)
	mux.HandleFunc("/shutdown", s.handleShutdown)

	return mux
}

func (s *AudioServer) handleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(map[string]any{
		"status":    "ok",
		"ready":     true,
		"uptime_ms": time.Since(s.startedAt).Milliseconds(),
		"timestamp": time.Now().UnixMilli(),
	})
}

func (s *AudioServer) handleAudioChunk(w http.ResponseWriter, r *http.Request) {
	start := time.Now()
	w.Header().Set("Content-Type", "application/json")

	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		_ = json.NewEncoder(w).Encode(AudioStatus{
			Status:    "error",
			LatencyMs: 0.01,
			Message:   "Only POST method is allowed",
		})
		return
	}

	body, err := io.ReadAll(r.Body)
	defer r.Body.Close()

	if err != nil {
		elapsed := float64(time.Since(start).Microseconds()) / 1000.0
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(AudioStatus{
			Status:    "error",
			LatencyMs: elapsed,
			Message:   fmt.Sprintf("Failed to read audio payload: %v", err),
		})
		return
	}

	if len(body) == 0 {
		elapsed := float64(time.Since(start).Microseconds()) / 1000.0
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(AudioStatus{
			Status:    "error",
			LatencyMs: elapsed,
			Message:   "Empty audio chunk (0 bytes)",
		})
		return
	}

	// 1. Checksum verification
	expectedChecksum := strings.TrimSpace(r.Header.Get("X-Audio-Checksum"))
	actualCrc := crc32.ChecksumIEEE(body)
	actualChecksumHex := fmt.Sprintf("%08x", actualCrc)

	if expectedChecksum != "" && !strings.EqualFold(expectedChecksum, actualChecksumHex) {
		elapsed := float64(time.Since(start).Microseconds()) / 1000.0
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(AudioStatus{
			Status:    "error",
			LatencyMs: elapsed,
			Message:   fmt.Sprintf("Checksum validation failed: expected %s, got %s", expectedChecksum, actualChecksumHex),
		})
		return
	}

	var seq int64
	if seqStr := r.Header.Get("X-Sequence-Number"); seqStr != "" {
		seq, _ = strconv.ParseInt(seqStr, 10, 64)
	}

	atomic.AddInt64(&s.framesIngested, 1)
	atomic.AddInt64(&s.bytesIngested, int64(len(body)))

	elapsed := float64(time.Since(start).Microseconds()) / 1000.0
	if elapsed < 0.01 {
		elapsed = 0.01
	}

	s.mu.Lock()
	s.lastLatencyMs = elapsed
	s.mu.Unlock()

	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(AudioStatus{
		Status:         "ok",
		LatencyMs:      elapsed,
		Message:        "Audio frame verified and ingested",
		BytesReceived:  len(body),
		SequenceNumber: seq,
		Timestamp:      time.Now().UnixMilli(),
	})
}

func (s *AudioServer) handleStatus(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	s.mu.RLock()
	lastLatency := s.lastLatencyMs
	s.mu.RUnlock()

	_ = json.NewEncoder(w).Encode(map[string]any{
		"status":          "ok",
		"frames_ingested": atomic.LoadInt64(&s.framesIngested),
		"bytes_ingested":  atomic.LoadInt64(&s.bytesIngested),
		"last_latency_ms": lastLatency,
		"uptime_ms":       time.Since(s.startedAt).Milliseconds(),
		"timestamp":       time.Now().UnixMilli(),
	})
}

func (s *AudioServer) handleShutdown(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"status": "shutting_down",
	})
	go func() {
		time.Sleep(100 * time.Millisecond)
		if s.server != nil {
			_ = s.server.Shutdown(context.Background())
		}
	}()
}

// Start runs the HTTP server and blocks until termination signal or error.
func (s *AudioServer) Start() error {
	addr := fmt.Sprintf("%s:%d", s.host, s.port)
	s.server = &http.Server{
		Addr:         addr,
		Handler:      s.Routes(),
		ReadTimeout:  5 * time.Second,
		WriteTimeout: 5 * time.Second,
	}

	return s.server.ListenAndServe()
}

// Close gracefully stops the server.
func (s *AudioServer) Close() error {
	if s.server != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()
		return s.server.Shutdown(ctx)
	}
	return nil
}

func main() {
	port := flag.Int("port", 9092, "Port for audio server HTTP/streaming endpoints")
	host := flag.String("host", "127.0.0.1", "Host address for audio server")
	flag.Parse()

	server := NewAudioServer(*host, *port)
	log.Printf("🚀 [AudioServer] Starting Go audio backend on http://%s:%d", *host, *port)

	// Graceful shutdown listener
	stopChan := make(chan os.Signal, 1)
	signal.Notify(stopChan, os.Interrupt, syscall.SIGTERM)

	go func() {
		<-stopChan
		log.Println("🛑 [AudioServer] Received termination signal, shutting down gracefully...")
		_ = server.Close()
	}()

	if err := server.Start(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("❌ [AudioServer] Server fatal error: %v", err)
	}
}
