// Package main provides the standalone daemon binary for Eloquent's high-performance
// audio processing service.
package main

import (
	"log"
	"os"
	"os/signal"
	"syscall"

	"eloquent-backend/pkg/audio"
	"eloquent-backend/pkg/config"
	"eloquent-backend/pkg/ipc"
)

func main() {
	// 1. Load and validate service configuration
	cfg := config.LoadFromEnv()
	if err := config.Validate(cfg); err != nil {
		log.Fatalf("[audio-service] invalid configuration: %v", err)
	}

	// 2. Build and boot AudioEngine
	engCfg := audio.DefaultEngineConfig()
	engCfg.SampleRate = uint32(cfg.SampleRate)
	engCfg.Channels = uint16(cfg.Channels)
	engCfg.VADThresholdRMS = cfg.VADThresholdRMS
	engCfg.QueueCapacity = 4096

	engine := audio.NewAudioEngine(engCfg)
	defer engine.Close()

	// 3. Initialize dynamic CodecRegistry (supports ELQ1, WAV, PCM16)
	codecRegistry := audio.DefaultCodecRegistry()

	// 4. Initialize and start high-throughput IPCServer
	ipcServer := ipc.NewIPCServer(engine, codecRegistry, cfg.BindAddr, cfg.MaxClients)
	if err := ipcServer.Start(); err != nil {
		log.Fatalf("[audio-service] failed to start IPC server on %s: %v", cfg.BindAddr, err)
	}

	log.Printf("[audio-service] 🎙️  Eloquent Audio Service running on %s", cfg.BindAddr)
	log.Printf("[audio-service] 📊  Stream endpoint: %s/audio/stream (SSE & ELQ1 binary)", cfg.BindAddr)
	log.Printf("[audio-service] 📥  Ingest endpoint: %s/audio/ingest (POST PCM bytes)", cfg.BindAddr)
	log.Printf("[audio-service] ⏱️  Clock sync endpoint: %s/audio/sync (POST V-Sync ticks)", cfg.BindAddr)
	log.Printf("[audio-service] 🩺  Status endpoint: %s/audio/status (GET)", cfg.BindAddr)
	log.Printf("[audio-service] 📈  Prometheus metrics: %s/audio/metrics/prometheus (GET)", cfg.BindAddr)

	// 5. Intercept OS interrupt signals for graceful termination
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	sig := <-quit

	log.Printf("[audio-service] 🛑 Received signal %v. Draining pipeline and shutting down...", sig)

	_ = ipcServer.Stop(cfg.ShutdownTimeout)
	_ = engine.Close()

	log.Println("[audio-service] ✅ Clean exit")
}
