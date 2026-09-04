package state

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"
)

func TestAudioEngineLifecycle(t *testing.T) {
	config := AudioEngineConfig{
		SampleRate:          48000,
		Channels:            1,
		BufferSize:          1024,
		MaxAllocatedBuffers: 32,
		HeartbeatTimeout:    1 * time.Second,
	}

	session := NewSessionManager("test-engine-session", nil)
	engine := NewAudioEngine(config, session)

	if !engine.IsDeviceActive() {
		t.Fatalf("expected device active initially")
	}
	if !engine.IsConnected() {
		t.Fatalf("expected connected initially")
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	if err := engine.Start(ctx); err != nil {
		t.Fatalf("failed to start engine: %v", err)
	}

	// SessionManager should reflect capturing
	if session.GetAudioStreamState() != AudioStreamCapturing {
		t.Fatalf("expected session audio state capturing, got %s", session.GetAudioStreamState())
	}

	// Ingest sample audio frames
	sampleFrame := make([]byte, 512)
	for i := range sampleFrame {
		sampleFrame[i] = byte(i % 256)
	}

	for i := 0; i < 10; i++ {
		if err := engine.IngestFrame(sampleFrame); err != nil {
			t.Fatalf("IngestFrame failed on index %d: %v", i, err)
		}
	}

	// Wait briefly for worker processing
	time.Sleep(50 * time.Millisecond)

	metrics := engine.GetMetrics()
	if metrics.FramesIngested != 10 {
		t.Fatalf("expected 10 frames ingested, got %d", metrics.FramesIngested)
	}
	if metrics.FramesProcessed == 0 {
		t.Fatalf("expected frames to be processed by worker")
	}

	if err := engine.Stop(); err != nil {
		t.Fatalf("failed to stop engine: %v", err)
	}

	if session.GetAudioStreamState() != AudioStreamInactive {
		t.Fatalf("expected session audio state inactive after stop, got %s", session.GetAudioStreamState())
	}
}

func TestAudioEngineBufferRecyclingZeroLeaks(t *testing.T) {
	config := AudioEngineConfig{
		SampleRate:          48000,
		Channels:            1,
		BufferSize:          2048,
		MaxAllocatedBuffers: 64,
		HeartbeatTimeout:    2 * time.Second,
	}

	engine := NewAudioEngine(config, nil)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	_ = engine.Start(ctx)

	dummy := make([]byte, 1024)
	// Ingest 500 frames through the pool
	for i := 0; i < 500; i++ {
		_ = engine.IngestFrame(dummy)
		if i%20 == 0 {
			time.Sleep(1 * time.Millisecond)
		}
	}

	time.Sleep(100 * time.Millisecond)

	metrics := engine.GetMetrics()
	// Active buffers should be bounded by queue capacity + pool overhead, not 500
	if metrics.ActiveBuffers > int64(config.MaxAllocatedBuffers*2) {
		t.Fatalf("buffer leak detected: active buffers %d exceeds expected limit %d",
			metrics.ActiveBuffers, config.MaxAllocatedBuffers*2)
	}

	_ = engine.Stop()
}

func TestAudioEngineDeviceDisconnectReconnect(t *testing.T) {
	config := AudioEngineConfig{
		SampleRate:          48000,
		Channels:            1,
		BufferSize:          512,
		MaxAllocatedBuffers: 16,
	}

	session := NewSessionManager("device-test-session", nil)
	engine := NewAudioEngine(config, session)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	_ = engine.Start(ctx)

	// Simulate hardware disconnection
	engine.OnDeviceDisconnected()
	if engine.IsDeviceActive() {
		t.Fatalf("expected device inactive after disconnect")
	}
	if session.GetAudioStreamState() != AudioStreamInactive {
		t.Fatalf("expected stream inactive after device disconnect")
	}

	// Ingestion should fail with ErrDeviceDisconnected
	err := engine.IngestFrame(make([]byte, 256))
	if !errors.Is(err, ErrDeviceDisconnected) {
		t.Fatalf("expected ErrDeviceDisconnected, got %v", err)
	}

	// Simulate hardware reconnection
	engine.OnDeviceReconnected("AirPods Max")
	if !engine.IsDeviceActive() {
		t.Fatalf("expected device active after reconnection")
	}
	metrics := engine.GetMetrics()
	if metrics.DeviceName != "AirPods Max" {
		t.Fatalf("expected device name AirPods Max, got %s", metrics.DeviceName)
	}

	// Subsequent ingestion should succeed
	err = engine.IngestFrame(make([]byte, 256))
	if err != nil {
		t.Fatalf("expected successful ingestion after reconnect, got %v", err)
	}

	_ = engine.Stop()
}

func TestAudioEngineIPCHeartbeatDrop(t *testing.T) {
	config := AudioEngineConfig{
		SampleRate:          48000,
		Channels:            1,
		BufferSize:          512,
		MaxAllocatedBuffers: 16,
		HeartbeatTimeout:    150 * time.Millisecond,
	}

	engine := NewAudioEngine(config, nil)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	_ = engine.Start(ctx)

	if !engine.IsConnected() {
		t.Fatalf("expected initially connected")
	}

	// Allow heartbeat timeout to expire without pings
	time.Sleep(300 * time.Millisecond)

	if engine.IsConnected() {
		t.Fatalf("expected IPC connection drop after timeout")
	}

	// Send heartbeat to restore connection
	engine.ReceiveHeartbeat()
	if !engine.IsConnected() {
		t.Fatalf("expected IPC connection restored after heartbeat")
	}

	_ = engine.Stop()
}

func TestAudioEngineConcurrentRace(t *testing.T) {
	config := AudioEngineConfig{
		SampleRate:          48000,
		Channels:            1,
		BufferSize:          1024,
		MaxAllocatedBuffers: 64,
		HeartbeatTimeout:    500 * time.Millisecond,
	}

	engine := NewAudioEngine(config, nil)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	_ = engine.Start(ctx)

	var wg sync.WaitGroup
	concurrency := 16

	for i := 0; i < concurrency; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			buf := engine.GetBuffer()
			defer engine.ReleaseBuffer(buf)

			dummy := make([]byte, 256)
			_ = engine.IngestFrame(dummy)
			_ = engine.ReceiveHeartbeat()
			_ = engine.GetMetrics()
			_ = engine.IsConnected()
			_ = engine.IsDeviceActive()

			if idx%4 == 0 {
				engine.OnDeviceDisconnected()
				engine.OnDeviceReconnected("Virtual Cable")
			}
		}(i)
	}

	wg.Wait()
	_ = engine.Stop()
}
