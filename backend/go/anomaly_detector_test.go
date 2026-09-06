package audio

import (
	"bytes"
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"
)

func TestSlidingWindow_Statistics(t *testing.T) {
	window := NewSlidingWindow(5)

	values := []float64{10.0, 20.0, 30.0, 40.0, 50.0}
	for _, v := range values {
		window.Push(v)
	}

	if window.Count() != 5 {
		t.Fatalf("Expected count 5, got %d", window.Count())
	}

	expectedMean := 30.0
	if math.Abs(window.Mean()-expectedMean) > 1e-6 {
		t.Fatalf("Expected mean %.2f, got %.2f", expectedMean, window.Mean())
	}

	if window.Min() != 10.0 {
		t.Fatalf("Expected min 10.0, got %.2f", window.Min())
	}
	if window.Max() != 50.0 {
		t.Fatalf("Expected max 50.0, got %.2f", window.Max())
	}

	// Push 6th value to test circular eviction: [60, 20, 30, 40, 50] -> mean = 40.0
	window.Push(60.0)
	if window.Count() != 5 {
		t.Fatalf("Expected count 5 after overflow, got %d", window.Count())
	}
	if math.Abs(window.Mean()-40.0) > 1e-6 {
		t.Fatalf("Expected new mean 40.0, got %.2f", window.Mean())
	}
	if window.Min() != 20.0 {
		t.Fatalf("Expected min 20.0 after evicting 10.0, got %.2f", window.Min())
	}
	if window.Max() != 60.0 {
		t.Fatalf("Expected max 60.0, got %.2f", window.Max())
	}

	stats := window.GetStats()
	if stats.Count != 5 || stats.Mean != 40.0 || stats.Min != 20.0 || stats.Max != 60.0 {
		t.Fatalf("GetStats() returned unexpected values: %+v", stats)
	}
}

func TestAnomalyDetector_LatencySpike(t *testing.T) {
	cfg := DefaultDetectorConfig()
	cfg.LatencyThresholdMs = 50.0
	cfg.LatencyZThreshold = 2.5
	cfg.LatencyWindowSize = 20
	detector := NewAnomalyDetector(cfg)

	// Ingest baseline normal latency (10-15ms)
	for i := 0; i < 15; i++ {
		sample := AudioLatencySample{
			StreamID:            "stream-test",
			FrameID:             uint64(i),
			TotalLatencyMs:      12.0 + float64(i%4),
			CaptureLatencyMs:    5.0,
			VADLatencyMs:        3.0,
			ProcessingLatencyMs: 4.0,
			Timestamp:           time.Now().UnixMilli(),
		}
		alert := detector.IngestLatencySample(sample)
		if alert != nil {
			t.Fatalf("Unexpected alert triggered for normal latency %.2fms", sample.TotalLatencyMs)
		}
	}

	// Ingest abnormal latency spike (85ms > 50ms)
	spike := AudioLatencySample{
		StreamID:            "stream-test",
		FrameID:             999,
		TotalLatencyMs:      85.0,
		CaptureLatencyMs:    20.0,
		VADLatencyMs:        15.0,
		ProcessingLatencyMs: 50.0,
		Timestamp:           time.Now().UnixMilli(),
	}
	alert := detector.IngestLatencySample(spike)
	if alert == nil {
		t.Fatal("Expected alert for 85ms latency spike, got nil")
	}

	if alert.AlertType != AlertAudioLatencySpike {
		t.Fatalf("Expected alertType '%s', got '%s'", AlertAudioLatencySpike, alert.AlertType)
	}
	if alert.CurrentValue != 85.0 {
		t.Fatalf("Expected alert currentValue 85.0, got %.2f", alert.CurrentValue)
	}

	history := detector.GetAlertHistory()
	if len(history) != 1 {
		t.Fatalf("Expected 1 alert in history, got %d", len(history))
	}
}

func TestAnomalyDetector_DropOffRate(t *testing.T) {
	cfg := DefaultDetectorConfig()
	cfg.DropOffWindowSize = 10
	cfg.DropOffRateThreshold = 0.15 // 15% drop-off threshold (= 85% completion)
	detector := NewAnomalyDetector(cfg)

	// Step completions: 8 completed sessions
	for i := 0; i < 8; i++ {
		detector.IngestUserInteraction(UserInteractionEvent{
			EventType: "step_complete",
			StepID:    fmt.Sprintf("step-%d", i),
			SessionID: fmt.Sprintf("session-%d", i),
			Timestamp: time.Now().UnixMilli(),
		})
	}

	rate, alert := detector.EvaluateDropOffRate()
	if rate < 0.85 {
		t.Fatalf("Expected high completion rate (100%%), got %.2f", rate)
	}
	if alert != nil {
		t.Fatalf("Unexpected alert for healthy completion rate: %+v", alert)
	}

	// Ingest 3 abandonments to drop completion rate below 85% (8 completed, 3 abandoned -> 8/10 in window = 70% completion, 30% drop-off)
	var triggeredAlert *AnomalyAlert
	for i := 0; i < 3; i++ {
		al := detector.IngestUserInteraction(UserInteractionEvent{
			EventType: "abandon",
			StepID:    "step-audio-setup",
			SessionID: fmt.Sprintf("abandon-%d", i),
			Timestamp: time.Now().UnixMilli(),
		})
		if al != nil {
			triggeredAlert = al
		}
	}

	if triggeredAlert == nil {
		t.Fatal("Expected high drop-off alert when completion rate dropped below 85%, got nil")
	}
	if triggeredAlert.AlertType != AlertHighDropOffRate {
		t.Fatalf("Expected alertType '%s', got '%s'", AlertHighDropOffRate, triggeredAlert.AlertType)
	}
}

func TestAnomalyDetector_BacktrackingFriction(t *testing.T) {
	cfg := DefaultDetectorConfig()
	cfg.BacktrackThreshold = 2
	detector := NewAnomalyDetector(cfg)

	// User backtracks 3 times (exceeds threshold of 2)
	alert := detector.IngestUserInteraction(UserInteractionEvent{
		EventType:      "backtrack",
		StepID:         "step-persona",
		BacktrackCount: 3,
		SessionID:      "sess-friction-1",
		Timestamp:      time.Now().UnixMilli(),
	})

	if alert == nil {
		t.Fatal("Expected friction alert for 3 backtracks, got nil")
	}
	if alert.AlertType != AlertExcessiveBacktracking {
		t.Fatalf("Expected alertType '%s', got '%s'", AlertExcessiveBacktracking, alert.AlertType)
	}
}

func TestAnomalyDetector_IdleFriction(t *testing.T) {
	cfg := DefaultDetectorConfig()
	cfg.IdleThresholdMs = 8000.0
	detector := NewAnomalyDetector(cfg)

	// User stalled for 12,000ms (>8,000ms threshold)
	alert := detector.IngestUserInteraction(UserInteractionEvent{
		EventType:      "dwell",
		StepID:         "step-hotkey",
		IdleDurationMs: 12000.0,
		SessionID:      "sess-idle-1",
		Timestamp:      time.Now().UnixMilli(),
	})

	if alert == nil {
		t.Fatal("Expected friction alert for 12s idle duration, got nil")
	}
	if alert.AlertType != AlertUserFrictionHigh {
		t.Fatalf("Expected alertType '%s', got '%s'", AlertUserFrictionHigh, alert.AlertType)
	}
}

func TestAnomalyDetector_ConcurrentStress(t *testing.T) {
	cfg := DefaultDetectorConfig()
	detector := NewAnomalyDetector(cfg)

	var wg sync.WaitGroup
	numWorkers := 8
	samplesPerWorker := 200

	for w := 0; w < numWorkers; w++ {
		wg.Add(1)
		go func(workerID int) {
			defer wg.Done()
			for i := 0; i < samplesPerWorker; i++ {
				detector.IngestLatencySample(AudioLatencySample{
					StreamID:       "stress-stream",
					FrameID:        uint64(workerID*1000 + i),
					TotalLatencyMs: 10.0 + float64(i%30),
					Timestamp:      time.Now().UnixMilli(),
				})
				detector.IngestUserInteraction(UserInteractionEvent{
					EventType:   "click",
					StepID:      "step-test",
					DwellTimeMs: float64(i * 10),
					SessionID:   "stress-sess",
					Timestamp:   time.Now().UnixMilli(),
				})
			}
		}(w)
	}

	wg.Wait()

	stats := detector.GetWindowStats("latency")
	if stats.Count == 0 {
		t.Fatal("Expected non-zero samples after concurrent ingestion")
	}
}

func TestAnomalyDetector_ServerEndpoints(t *testing.T) {
	cfg := DefaultDetectorConfig()
	detector := NewAnomalyDetector(cfg)
	handler := detector.Handler()

	// 1. Test /health
	req := httptest.NewRequest("GET", "/health", nil)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("Expected 200 OK from /health, got status %d", w.Code)
	}

	// 2. Test /analytics/metrics HTTP POST
	payload := map[string]interface{}{
		"latencySamples": []AudioLatencySample{
			{StreamID: "test", FrameID: 1, TotalLatencyMs: 65.0, Timestamp: time.Now().UnixMilli()},
		},
		"userEvents": []UserInteractionEvent{
			{EventType: "step_complete", StepID: "step-1", SessionID: "s1", Timestamp: time.Now().UnixMilli()},
		},
	}
	data, _ := json.Marshal(payload)
	req = httptest.NewRequest("POST", "/analytics/metrics", bytes.NewReader(data))
	req.Header.Set("Content-Type", "application/json")
	w = httptest.NewRecorder()
	handler.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("Expected 200 OK from /analytics/metrics, got status %d", w.Code)
	}

	// 3. Test /analytics/alerts
	req = httptest.NewRequest("GET", "/analytics/alerts", nil)
	w = httptest.NewRecorder()
	handler.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("Expected 200 OK from /analytics/alerts, got status %d", w.Code)
	}
	var alerts []AnomalyAlert
	_ = json.NewDecoder(w.Body).Decode(&alerts)

	if len(alerts) == 0 {
		t.Fatal("Expected at least 1 alert from 65ms latency sample, got 0")
	}

	// 4. Test /analytics/status
	req = httptest.NewRequest("GET", "/analytics/status", nil)
	w = httptest.NewRecorder()
	handler.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("Expected 200 OK from /analytics/status, got status %d", w.Code)
	}
}
