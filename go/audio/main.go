package main

import (
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"log"
	"math"
	"net/http"
	"os"
	"os/signal"
	"sync"
	"sync/atomic"
	"syscall"
	"time"
)

// AmbientAudioEngine manages lo-fi ambient stream synthesis and buffering.
type AmbientAudioEngine struct {
	mu             sync.RWMutex
	isPlaying      atomic.Bool
	mode           string
	volume         float64
	sampleRate     int
	channels       int
	frameSize      int
	bufferCap      int
	frameQueue     chan []byte
	stopChan       chan struct{}
	bufferedFrames atomic.Int64
	underrunCount  atomic.Int64
}

// AmbientConfig configures ambient lo-fi synthesis parameters.
type AmbientConfig struct {
	SampleRate int     `json:"sampleRate"`
	Channels   int     `json:"channels"`
	BufferSize int     `json:"bufferSize"`
	Volume     float64 `json:"volume"`
	Mode       string  `json:"mode"`
}

// NewAmbientAudioEngine creates an ambient lo-fi loop playback engine.
func NewAmbientAudioEngine(cfg AmbientConfig) *AmbientAudioEngine {
	if cfg.SampleRate <= 0 {
		cfg.SampleRate = 44100
	}
	if cfg.Channels <= 0 {
		cfg.Channels = 2
	}
	if cfg.BufferSize <= 0 {
		cfg.BufferSize = 1024
	}
	if cfg.Volume <= 0 {
		cfg.Volume = 0.8
	}
	if cfg.Mode == "" {
		cfg.Mode = "cozy-high"
	}

	engine := &AmbientAudioEngine{
		mode:       cfg.Mode,
		volume:     cfg.Volume,
		sampleRate: cfg.SampleRate,
		channels:   cfg.Channels,
		frameSize:  cfg.BufferSize,
		bufferCap:  512,
		frameQueue: make(chan []byte, 512),
		stopChan:   make(chan struct{}),
	}

	return engine
}

// Start initiates the background lo-fi sound loop synthesizer.
func (e *AmbientAudioEngine) Start(mode string, volume float64) error {
	e.mu.Lock()
	defer e.mu.Unlock()

	if e.isPlaying.Load() {
		if mode != "" {
			e.mode = mode
		}
		if volume > 0 {
			e.volume = volume
		}
		return nil
	}

	if mode != "" {
		e.mode = mode
	}
	if volume > 0 {
		e.volume = volume
	}

	e.stopChan = make(chan struct{})
	e.isPlaying.Store(true)

	go e.loFiLoopGenerator(e.stopChan)

	return nil
}

// Stop terminates the ambient loop and drains the buffer.
func (e *AmbientAudioEngine) Stop() error {
	e.mu.Lock()
	defer e.mu.Unlock()

	if !e.isPlaying.Load() {
		return nil
	}

	e.isPlaying.Store(false)
	close(e.stopChan)

	// Drain remaining frames
	for len(e.frameQueue) > 0 {
		<-e.frameQueue
		e.bufferedFrames.Add(-1)
	}

	return nil
}

// Status returns the current engine state.
func (e *AmbientAudioEngine) Status() map[string]interface{} {
	e.mu.RLock()
	defer e.mu.RUnlock()

	return map[string]interface{}{
		"isPlaying":      e.isPlaying.Load(),
		"mode":           e.mode,
		"volume":         e.volume,
		"sampleRate":     e.sampleRate,
		"channels":       e.channels,
		"bufferedFrames": e.bufferedFrames.Load(),
		"underruns":      e.underrunCount.Load(),
		"timestamp":      time.Now().UnixMilli(),
	}
}

// loFiLoopGenerator generates warm harmonic lo-fi frames with soft tape saturation.
func (e *AmbientAudioEngine) loFiLoopGenerator(stop <-chan struct{}) {
	rootFreq := 130.81    // C3
	fifthFreq := 196.00   // G3
	seventhFreq := 246.94 // B3
	warmthLFO := 0.2      // 0.2 Hz subtle drift

	ticker := time.NewTicker(20 * time.Millisecond)
	defer ticker.Stop()

	var phase float64
	var lfoPhase float64

	for {
		select {
		case <-stop:
			return
		case <-ticker.C:
			if !e.isPlaying.Load() {
				return
			}

			samples := e.frameSize
			frame := make([]byte, samples*e.channels*2)

			e.mu.RLock()
			vol := e.volume
			e.mu.RUnlock()

			for i := 0; i < samples; i++ {
				t := float64(i) / float64(e.sampleRate)
				lfo := 0.85 + 0.15*math.Sin(2*math.Pi*warmthLFO*(lfoPhase+t))

				s1 := math.Sin(2 * math.Pi * rootFreq * (phase + t))
				s2 := 0.6 * math.Sin(2*math.Pi*fifthFreq*(phase+t))
				s3 := 0.4 * math.Sin(2*math.Pi*seventhFreq*(phase+t))

				combined := (s1 + s2 + s3) * 0.33 * vol * lfo
				saturated := math.Tanh(combined)

				val := int16(saturated * 32767.0)

				idx := i * e.channels * 2
				frame[idx] = byte(val)
				frame[idx+1] = byte(val >> 8)
				if e.channels > 1 {
					frame[idx+2] = byte(val)
					frame[idx+3] = byte(val >> 8)
				}
			}

			phase += float64(samples) / float64(e.sampleRate)
			if phase > 1000.0 {
				phase -= 1000.0
			}
			lfoPhase += float64(samples) / float64(e.sampleRate)
			if lfoPhase > 1000.0 {
				lfoPhase -= 1000.0
			}

			select {
			case e.frameQueue <- frame:
				e.bufferedFrames.Add(1)
			default:
				e.underrunCount.Add(1)
			}
		}
	}
}

type ambientRequest struct {
	Action string  `json:"action"` // "start" or "stop"
	Mode   string  `json:"mode"`   // e.g. "cozy-high"
	Volume float64 `json:"volume"` // e.g. 0.8
}

func main() {
	portFlag := flag.String("port", "", "Port to listen on")
	flag.Parse()

	port := *portFlag
	if port == "" {
		port = os.Getenv("AUDIO_PORT")
	}
	if port == "" {
		port = os.Getenv("PORT")
	}
	if port == "" {
		port = "9092"
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	engine := NewAmbientAudioEngine(AmbientConfig{
		SampleRate: 44100,
		Channels:   2,
		BufferSize: 1024,
		Volume:     0.8,
		Mode:       "cozy-high",
	})

	mux := http.NewServeMux()

	// 1. Health check
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"status":    "ok",
			"ready":     true,
			"service":   "eloquent-audio-server",
			"pid":       os.Getpid(),
			"timestamp": time.Now().UnixMilli(),
		})
	})

	// 2. Ambient control: start/stop lo-fi loop
	mux.HandleFunc("/audio/ambient", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		if r.Method == http.MethodGet {
			_ = json.NewEncoder(w).Encode(engine.Status())
			return
		}

		if r.Method != http.MethodPost {
			http.Error(w, `{"error":"Method Not Allowed"}`, http.StatusMethodNotAllowed)
			return
		}

		var req ambientRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			req.Action = "start"
			req.Mode = "cozy-high"
			req.Volume = 0.8
		}

		if req.Action == "stop" {
			if err := engine.Stop(); err != nil {
				http.Error(w, fmt.Sprintf(`{"error":"%s"}`, err.Error()), http.StatusInternalServerError)
				return
			}
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"success": true,
				"action":  "stop",
				"status":  engine.Status(),
			})
			return
		}

		if req.Mode == "" {
			req.Mode = "cozy-high"
		}
		if req.Volume <= 0 {
			req.Volume = 0.8
		}

		if err := engine.Start(req.Mode, req.Volume); err != nil {
			http.Error(w, fmt.Sprintf(`{"error":"%s"}`, err.Error()), http.StatusInternalServerError)
			return
		}

		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"success": true,
			"action":  "start",
			"mode":    req.Mode,
			"volume":  req.Volume,
			"status":  engine.Status(),
		})
	})

	// 3. Ambient status
	mux.HandleFunc("/audio/ambient/status", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(engine.Status())
	})

	// 4. Audio Config endpoint: GET/POST configuration
	mux.HandleFunc("/audio/config", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		if r.Method == http.MethodGet {
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"success": true,
				"config":  GetConfig(),
			})
			return
		}

		if r.Method == http.MethodPost {
			var newCfg AudioConfig
			if err := json.NewDecoder(r.Body).Decode(&newCfg); err != nil {
				http.Error(w, fmt.Sprintf(`{"success":false,"error":"Invalid payload: %s"}`, err.Error()), http.StatusBadRequest)
				return
			}

			if err := SetConfig(newCfg); err != nil {
				http.Error(w, fmt.Sprintf(`{"success":false,"error":"%s"}`, err.Error()), http.StatusBadRequest)
				return
			}

			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"success": true,
				"config":  GetConfig(),
			})
			return
		}

		http.Error(w, `{"error":"Method Not Allowed"}`, http.StatusMethodNotAllowed)
	})

	// Background listener for real-time config channel updates
	go func() {
		ch := GetConfigUpdateChannel()
		for {
			select {
			case <-ctx.Done():
				return
			case updatedCfg := <-ch:
				engine.mu.Lock()
				engine.sampleRate = updatedCfg.SampleRate
				engine.frameSize = updatedCfg.BufferSize
				if updatedCfg.Volume > 0 {
					engine.volume = updatedCfg.Volume
				}
				engine.mu.Unlock()
				log.Printf("⚡ [AudioServer] Real-time audio parameters updated: SampleRate=%d, BufferSize=%d, OutputDevice=%s\n",
					updatedCfg.SampleRate, updatedCfg.BufferSize, updatedCfg.OutputDevice)
			}
		}
	}()

	// 5. Backward-compatible endpoints
	mux.HandleFunc("/audio/start", func(w http.ResponseWriter, r *http.Request) {
		_ = engine.Start("cozy-high", 0.8)
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]interface{}{"ok": true, "status": engine.Status()})
	})

	mux.HandleFunc("/audio/stop", func(w http.ResponseWriter, r *http.Request) {
		_ = engine.Stop()
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]interface{}{"ok": true, "status": engine.Status()})
	})

	mux.HandleFunc("/audio/status", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"status":      "ok",
			"ready":       true,
			"isStreaming": engine.isPlaying.Load(),
			"ambient":     engine.Status(),
			"config":      GetConfig(),
		})
	})

	// 5. Explicit shutdown endpoint
	mux.HandleFunc("/shutdown", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]interface{}{"status": "shutting_down"})
		go func() {
			time.Sleep(50 * time.Millisecond)
			stop()
		}()
	})

	addr := fmt.Sprintf("127.0.0.1:%s", port)
	server := &http.Server{
		Addr:    addr,
		Handler: mux,
	}

	go func() {
		log.Printf("🎙️ [AudioServer] Lo-Fi Audio Server listening on http://%s\n", addr)
		if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("❌ [AudioServer] Server fatal error: %v\n", err)
		}
	}()

	<-ctx.Done()
	log.Println("🛑 [AudioServer] Shutdown signal received, gracefully draining stream...")

	_ = engine.Stop()

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	if err := server.Shutdown(shutdownCtx); err != nil {
		log.Printf("⚠️ [AudioServer] Forced shutdown error: %v\n", err)
	}

	log.Println("🏁 [AudioServer] Clean exit complete.")
}
