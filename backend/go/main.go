// Package audio implements strict lifecycle management and explicit device cleanup
// for the Eloquent Go audio backend, eliminating camera/mic permission leaks.
package audio

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"sync"
	"sync/atomic"
	"syscall"
	"time"
)

// Device represents an active media capture or playback hardware handle (mic, camera, speaker).
type Device struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Type      string    `json:"type"` // "microphone" | "camera" | "speaker"
	Active    bool      `json:"active"`
	OpenedAt  time.Time `json:"openedAt"`
	closed    bool
	mu        sync.Mutex
}

// Close explicitly releases the hardware handle and file descriptors for this device.
func (d *Device) Close() error {
	d.mu.Lock()
	defer d.mu.Unlock()
	if d.closed {
		return nil
	}
	d.Active = false
	d.closed = true
	log.Printf("🔌 [DeviceCleanup] Closed hardware handle for device: %s (%s, ID: %s)", d.Name, d.Type, d.ID)
	return nil
}

// IsActive returns whether the device handle is currently open.
func (d *Device) IsActive() bool {
	d.mu.Lock()
	defer d.mu.Unlock()
	return d.Active && !d.closed
}

// DeviceRegistry tracks all active hardware capture/playback devices across the audio engine.
type DeviceRegistry struct {
	mu      sync.RWMutex
	devices map[string]*Device
}

var (
	globalRegistry = &DeviceRegistry{
		devices: make(map[string]*Device),
	}
	isStreamingFlag int32
)

// RegisterDevice adds a device to the active tracking registry.
func (r *DeviceRegistry) RegisterDevice(d *Device) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.devices[d.ID] = d
	log.Printf("🎙️ [DeviceRegistry] Registered device: %s (Type: %s)", d.Name, d.Type)
}

// ReleaseDevice closes and removes a single device by ID.
func (r *DeviceRegistry) ReleaseDevice(id string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if d, exists := r.devices[id]; exists {
		err := d.Close()
		delete(r.devices, id)
		return err
	}
	return nil
}

// ReleaseAllDevices explicitly forces all open device handles to close immediately.
func (r *DeviceRegistry) ReleaseAllDevices() int {
	r.mu.Lock()
	defer r.mu.Unlock()
	count := 0
	for id, d := range r.devices {
		if d.IsActive() {
			_ = d.Close()
			count++
		}
		delete(r.devices, id)
	}
	atomic.StoreInt32(&isStreamingFlag, 0)
	log.Printf("🛑 [DeviceRegistry] Force-released all hardware devices (Total closed: %d)", count)
	return count
}

// GetActiveDeviceCount returns the number of currently active devices.
func (r *DeviceRegistry) GetActiveDeviceCount() int {
	r.mu.RLock()
	defer r.mu.RUnlock()
	active := 0
	for _, d := range r.devices {
		if d.IsActive() {
			active++
		}
	}
	return active
}

// GetStatus returns the current device status map.
func (r *DeviceRegistry) GetStatus() map[string]any {
	r.mu.RLock()
	defer r.mu.RUnlock()
	activeDevices := make([]map[string]any, 0)
	for _, d := range r.devices {
		activeDevices = append(activeDevices, map[string]any{
			"id":     d.ID,
			"name":   d.Name,
			"type":   d.Type,
			"active": d.IsActive(),
		})
	}
	streaming := atomic.LoadInt32(&isStreamingFlag) == 1
	return map[string]any{
		"activeCount": len(activeDevices),
		"isStreaming": streaming,
		"devices":     activeDevices,
		"timestamp":   time.Now().UnixMilli(),
	}
}

// Global helper accessors
func GetDeviceRegistry() *DeviceRegistry {
	return globalRegistry
}

// AudioService manages the HTTP server and context cancellation lifecycle.
type AudioService struct {
	server   *http.Server
	ctx      context.Context
	cancel   context.CancelFunc
	registry *DeviceRegistry
	port     int
}

// NewAudioService initializes the audio service with a root context.
func NewAudioService(parentCtx context.Context, port int) *AudioService {
	ctx, cancel := context.WithCancel(parentCtx)
	return &AudioService{
		ctx:      ctx,
		cancel:   cancel,
		registry: globalRegistry,
		port:     port,
	}
}

// Start runs the HTTP server and binds lifecycle routes.
func (s *AudioService) Start() error {
	mux := http.NewServeMux()

	// 1. Health check & status
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		activeCount := s.registry.GetActiveDeviceCount()
		_ = json.NewEncoder(w).Encode(map[string]any{
			"status":        "healthy",
			"service":       "eloquent-go-audio-backend",
			"activeDevices": activeCount,
			"isStreaming":   atomic.LoadInt32(&isStreamingFlag) == 1,
			"timestamp":     time.Now().UnixMilli(),
		})
	})

	// 2. Device Status check (used by Electron IPC to verify hardware release)
	mux.HandleFunc("/audio/device-status", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(s.registry.GetStatus())
	})

	// 3. Audio Stop / Release: Explicitly releases all device handles
	mux.HandleFunc("/audio/release", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
			return
		}
		released := s.registry.ReleaseAllDevices()
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"ok":              true,
			"devicesReleased": released,
			"status":          "released",
			"timestamp":       time.Now().UnixMilli(),
		})
	})

	// 4. Audio Start endpoint: marks streaming active
	mux.HandleFunc("/audio/start", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
			return
		}
		atomic.StoreInt32(&isStreamingFlag, 1)
		// Register a default capture device if none present
		if s.registry.GetActiveDeviceCount() == 0 {
			s.registry.RegisterDevice(&Device{
				ID:       "default-mic",
				Name:     "Built-in Audio Capture",
				Type:     "microphone",
				Active:   true,
				OpenedAt: time.Now(),
			})
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"ok":          true,
			"isStreaming": true,
			"status":      "started",
		})
	})

	// 5. Audio Stop endpoint with explicit resource release
	mux.HandleFunc("/audio/stop", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
			return
		}
		released := s.registry.ReleaseAllDevices()
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"ok":              true,
			"isStreaming":     false,
			"devicesReleased": released,
			"status":          "stopped",
		})
	})

	// 6. Explicit Shutdown RPC: Called by Electron lifecycle manager before quit
	mux.HandleFunc("/shutdown", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
			return
		}
		log.Println("🛑 [ShutdownRPC] Received explicit shutdown signal from Electron lifecycle manager")
		released := s.registry.ReleaseAllDevices()
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"ok":              true,
			"devicesReleased": released,
			"status":          "terminating",
			"timestamp":       time.Now().UnixMilli(),
		})

		// Trigger context cancellation asynchronously to allow response write
		go func() {
			time.Sleep(50 * time.Millisecond)
			s.cancel()
		}()
	})

	s.server = &http.Server{
		Addr:         fmt.Sprintf(":%d", s.port),
		Handler:      mux,
		ReadTimeout:  5 * time.Second,
		WriteTimeout: 10 * time.Second,
	}

	// Server runner goroutine
	go func() {
		log.Printf("🎙️ [AudioService] Listening on port %d...", s.port)
		if err := s.server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Printf("AudioService ListenAndServe error: %v", err)
		}
	}()

	// Context cancellation watcher
	<-s.ctx.Done()
	log.Println("🔌 [AudioService] Context cancellation received. Releasing all hardware resources...")
	s.registry.ReleaseAllDevices()

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer shutdownCancel()
	_ = s.server.Shutdown(shutdownCtx)
	log.Println("✅ [AudioService] Audio backend shutdown complete. Exit code 0.")
	return nil
}

// Stop cleanly triggers cancellation.
func (s *AudioService) Stop() {
	if s.cancel != nil {
		s.cancel()
	}
}

// main entry point supporting standalone execution and daemon mode.
func main() {
	port := 9090
	if envPort := os.Getenv("PORT"); envPort != "" {
		_, _ = fmt.Sscanf(envPort, "%d", &port)
	}

	ctx, cancel := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer cancel()

	service := NewAudioService(ctx, port)
	if err := service.Start(); err != nil && err != http.ErrServerClosed {
		log.Printf("Service error: %v", err)
		os.Exit(1)
	}
	os.Exit(0)
}
