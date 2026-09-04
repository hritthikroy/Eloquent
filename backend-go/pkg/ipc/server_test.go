package ipc

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"eloquent-backend/pkg/audio"
)

func TestIPCServer_LifecycleAndEndpoints(t *testing.T) {
	engCfg := audio.DefaultEngineConfig()
	engCfg.NumWorkers = 2
	engine := audio.NewAudioEngine(engCfg)
	defer engine.Close()

	registry := audio.DefaultCodecRegistry()
	server := NewIPCServer(engine, registry, "127.0.0.1:0", 16)
	handler := server.Handler()

	// 1. GET /audio/status
	req := httptest.NewRequest(http.MethodGet, "/audio/status", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d", rec.Code)
	}
	var status IPCStatus
	if err := json.NewDecoder(rec.Body).Decode(&status); err != nil {
		t.Fatalf("failed to decode status JSON: %v", err)
	}
	if !status.IsHealthy {
		t.Fatal("expected status.IsHealthy == true")
	}

	// 2. POST /audio/sync
	syncBody := `{"visualTimestampNs": 1000000000, "targetFps": 60.0}`
	req = httptest.NewRequest(http.MethodPost, "/audio/sync", strings.NewReader(syncBody))
	req.Header.Set("Content-Type", "application/json")
	rec = httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d", rec.Code)
	}
	var syncResp SyncResponse
	if err := json.NewDecoder(rec.Body).Decode(&syncResp); err != nil {
		t.Fatalf("failed to decode sync JSON: %v", err)
	}
	if !syncResp.OK {
		t.Fatal("expected syncResp.OK == true")
	}

	// 3. POST /audio/ingest
	pcmData := make([]byte, 1920)
	for i := range pcmData {
		pcmData[i] = byte(i % 128)
	}
	req = httptest.NewRequest(http.MethodPost, "/audio/ingest", bytes.NewReader(pcmData))
	req.Header.Set("Content-Type", "application/octet-stream")
	rec = httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d", rec.Code)
	}
	var ingestResp map[string]interface{}
	if err := json.NewDecoder(rec.Body).Decode(&ingestResp); err != nil {
		t.Fatalf("failed to decode ingest response: %v", err)
	}
	if ingestResp["ok"] != true {
		t.Fatalf("expected ok=true, got %v", ingestResp)
	}

	// 4. GET /audio/metrics/prometheus
	req = httptest.NewRequest(http.MethodGet, "/audio/metrics/prometheus", nil)
	rec = httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d", rec.Code)
	}
	metricsOutput := rec.Body.String()
	if !strings.Contains(metricsOutput, "eloquent_audio_frames_ingested_total") {
		t.Fatalf("expected prometheus metrics output, got: %s", metricsOutput)
	}

	// Test Stop idempotence
	if err := server.Stop(1 * time.Second); err != nil {
		t.Fatalf("unexpected stop error: %v", err)
	}
	if err := server.Stop(1 * time.Second); err != nil {
		t.Fatalf("expected second stop to be nil, got: %v", err)
	}
}

func TestIPCServer_StreamingSSEAndBinary(t *testing.T) {
	engCfg := audio.DefaultEngineConfig()
	engCfg.NumWorkers = 2
	engine := audio.NewAudioEngine(engCfg)
	defer engine.Close()

	registry := audio.DefaultCodecRegistry()
	server := NewIPCServer(engine, registry, "127.0.0.1:0", 16)
	handler := server.Handler()

	// 1. Connect SSE client with cancellable context
	ctx, cancel := context.WithCancel(context.Background())
	req := httptest.NewRequest(http.MethodGet, "/audio/stream?format=sse", nil).WithContext(ctx)
	req.Header.Set("Accept", "text/event-stream")
	rec := httptest.NewRecorder()

	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		defer wg.Done()
		handler.ServeHTTP(rec, req)
	}()

	// Allow client registration
	time.Sleep(20 * time.Millisecond)

	// Ingest a frame through engine
	pcmData := make([]byte, 480)
	for i := range pcmData {
		pcmData[i] = byte(i)
	}
	_, _ = engine.Submit(pcmData, 555)

	time.Sleep(50 * time.Millisecond)

	// Cancel stream context to disconnect client cleanly
	cancel()
	wg.Wait()

	body := rec.Body.String()
	if !strings.Contains(body, "event: connected") {
		t.Fatalf("expected connected event in body, got: %s", body)
	}

	// 2. Connect Binary streaming client (ELQ1)
	ctx2, cancel2 := context.WithCancel(context.Background())
	req2 := httptest.NewRequest(http.MethodGet, "/audio/stream?format=elq1", nil).WithContext(ctx2)
	rec2 := httptest.NewRecorder()

	wg.Add(1)
	go func() {
		defer wg.Done()
		handler.ServeHTTP(rec2, req2)
	}()

	time.Sleep(20 * time.Millisecond)
	_, _ = engine.Submit(pcmData, 777)
	time.Sleep(50 * time.Millisecond)

	cancel2()
	wg.Wait()

	if rec2.Header().Get("Content-Type") != "application/octet-stream" {
		t.Fatalf("expected octet-stream Content-Type, got %s", rec2.Header().Get("Content-Type"))
	}
}

func TestIPCServer_ErrorHandling(t *testing.T) {
	engCfg := audio.DefaultEngineConfig()
	engine := audio.NewAudioEngine(engCfg)
	defer engine.Close()

	server := NewIPCServer(engine, nil, "127.0.0.1:0", 2)
	handler := server.Handler()

	// Ingest with GET (method not allowed)
	req := httptest.NewRequest(http.MethodGet, "/audio/ingest", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusMethodNotAllowed {
		t.Fatalf("expected 405 Method Not Allowed, got %d", rec.Code)
	}

	// Ingest with empty body
	req = httptest.NewRequest(http.MethodPost, "/audio/ingest", bytes.NewReader(nil))
	rec = httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 Bad Request, got %d", rec.Code)
	}

	// Max clients limit check
	server.maxClients = 0 // force limit 0
	ctx, cancel := context.WithCancel(context.Background())
	req = httptest.NewRequest(http.MethodGet, "/audio/stream", nil).WithContext(ctx)
	rec = httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	cancel()

	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503 Service Unavailable when max clients exceeded, got %d", rec.Code)
	}

	// Call stop and test closed server response
	_ = server.Stop(1 * time.Second)
	req = httptest.NewRequest(http.MethodGet, "/audio/stream", nil)
	rec = httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503 after server close, got %d", rec.Code)
	}

	// Test Start() on closed server
	if err := server.Start(); err != ErrServerClosed {
		t.Fatalf("expected ErrServerClosed on closed server, got %v", err)
	}
}

func TestIPCServer_ConcurrencyAndRace(t *testing.T) {
	engCfg := audio.DefaultEngineConfig()
	engCfg.NumWorkers = 4
	engine := audio.NewAudioEngine(engCfg)
	defer engine.Close()

	server := NewIPCServer(engine, audio.DefaultCodecRegistry(), "127.0.0.1:0", 32)
	handler := server.Handler()

	var wg sync.WaitGroup
	numClients := 6
	iterations := 50

	pcmData := make([]byte, 960)

	for c := 0; c < numClients; c++ {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()
			for i := 0; i < iterations; i++ {
				if i%3 == 0 {
					req := httptest.NewRequest(http.MethodPost, "/audio/ingest", bytes.NewReader(pcmData))
					rec := httptest.NewRecorder()
					handler.ServeHTTP(rec, req)
				} else if i%3 == 1 {
					req := httptest.NewRequest(http.MethodGet, "/audio/status", nil)
					rec := httptest.NewRecorder()
					handler.ServeHTTP(rec, req)
				} else {
					req := httptest.NewRequest(http.MethodPost, "/audio/sync", strings.NewReader(`{"visualTimestampNs": 12345}`))
					rec := httptest.NewRecorder()
					handler.ServeHTTP(rec, req)
				}
			}
		}(c)
	}

	wg.Wait()
}
