// Package audio provides real-time audio processing and statistical anomaly detection.
// anomaly-detector.go implements a high-throughput sliding window statistical engine
// that flags anomalies in audio processing latency, user onboarding friction, and drop-off rates,
// broadcasting structured JSON alerts to the Electron frontend over a bidirectional WebSocket channel.
package audio

import (
	"bufio"
	"crypto/sha1"
	"encoding/base64"
	"encoding/binary"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"net"
	"net/http"
	"sort"
	"strings"
	"sync"
	"sync/atomic"
	"time"
)

// Metric Type Constants
const (
	AlertAudioLatencySpike      = "audio_latency_spike"
	AlertUserFrictionHigh       = "user_friction_high"
	AlertHighDropOffRate        = "high_drop_off_rate"
	AlertExcessiveBacktracking  = "excessive_backtracking"
	AlertBufferUnderrunSurge    = "buffer_underrun_surge"

	SeverityLow      = "low"
	SeverityMedium   = "medium"
	SeverityHigh     = "high"
	SeverityCritical = "critical"
)

// UserInteractionEvent represents a user behavior action from the onboarding flow.
type UserInteractionEvent struct {
	EventType      string                 `json:"eventType"`
	StepID         string                 `json:"stepId"`
	StepIndex      int                    `json:"stepIndex,omitempty"`
	ElementID      string                 `json:"elementId,omitempty"`
	DwellTimeMs    float64                `json:"dwellTimeMs,omitempty"`
	IdleDurationMs float64                `json:"idleDurationMs,omitempty"`
	BacktrackCount int                    `json:"backtrackCount,omitempty"`
	Timestamp      int64                  `json:"timestamp"`
	SessionID      string                 `json:"sessionId"`
	UserID         string                 `json:"userId,omitempty"`
	Metadata       map[string]interface{} `json:"metadata,omitempty"`
}

// AudioLatencySample represents latency metrics recorded for an audio processing frame.
type AudioLatencySample struct {
	StreamID            string  `json:"streamId"`
	FrameID             uint64  `json:"frameId"`
	CaptureLatencyMs    float64 `json:"captureLatencyMs"`
	VADLatencyMs        float64 `json:"vadLatencyMs"`
	ProcessingLatencyMs float64 `json:"processingLatencyMs"`
	TotalLatencyMs      float64 `json:"totalLatencyMs"`
	BufferUnderruns     int     `json:"bufferUnderruns,omitempty"`
	BufferOverruns      int     `json:"bufferOverruns,omitempty"`
	SampleRate          uint32  `json:"sampleRate,omitempty"`
	Timestamp           int64   `json:"timestamp"`
}

// AnomalyAlert represents a structured alert emitted when performance thresholds are breached.
type AnomalyAlert struct {
	ID                string                 `json:"id"`
	AlertType         string                 `json:"alertType"`
	Severity          string                 `json:"severity"`
	MetricName        string                 `json:"metricName"`
	CurrentValue      float64                `json:"currentValue"`
	ThresholdValue    float64                `json:"thresholdValue"`
	SlidingWindowSize int                    `json:"slidingWindowSize"`
	WindowMean        float64                `json:"windowMean,omitempty"`
	WindowStdDev      float64                `json:"windowStdDev,omitempty"`
	ZScore            float64                `json:"zScore,omitempty"`
	Timestamp         int64                  `json:"timestamp"`
	Details           string                 `json:"details"`
	SuggestedAction   string                 `json:"suggestedAction,omitempty"`
	Metadata          map[string]interface{} `json:"metadata,omitempty"`
}

// SlidingWindowStats summarizes the statistical state of a sliding window.
type SlidingWindowStats struct {
	Count      int     `json:"count"`
	Mean       float64 `json:"mean"`
	Variance   float64 `json:"variance"`
	StdDev     float64 `json:"stdDev"`
	P95        float64 `json:"p95"`
	Min        float64 `json:"min"`
	Max        float64 `json:"max"`
	SampleSize int     `json:"sampleSize"`
}

// SlidingWindow maintains a ring buffer of float64 samples with O(1) rolling statistics.
type SlidingWindow struct {
	mu         sync.RWMutex
	capacity   int
	buffer     []float64
	head       int
	size       int
	sum        float64
	sumSquares float64
}

// NewSlidingWindow creates a new circular buffer with the specified capacity.
func NewSlidingWindow(capacity int) *SlidingWindow {
	if capacity <= 0 {
		capacity = 100
	}
	return &SlidingWindow{
		capacity: capacity,
		buffer:   make([]float64, capacity),
	}
}

// Push adds a new sample into the sliding window and updates rolling statistics.
func (sw *SlidingWindow) Push(val float64) {
	sw.mu.Lock()
	defer sw.mu.Unlock()

	if sw.size < sw.capacity {
		sw.buffer[sw.head] = val
		sw.sum += val
		sw.sumSquares += val * val
		sw.size++
		sw.head = (sw.head + 1) % sw.capacity
	} else {
		oldVal := sw.buffer[sw.head]
		sw.sum = sw.sum - oldVal + val
		sw.sumSquares = sw.sumSquares - (oldVal * oldVal) + (val * val)
		if sw.sumSquares < 0 {
			sw.sumSquares = 0 // Guard against float precision drift
		}
		sw.buffer[sw.head] = val
		sw.head = (sw.head + 1) % sw.capacity
	}
}

// Count returns the current number of samples in the window.
func (sw *SlidingWindow) Count() int {
	sw.mu.RLock()
	defer sw.mu.RUnlock()
	return sw.size
}

// Mean returns the arithmetic mean of samples currently in the window.
func (sw *SlidingWindow) Mean() float64 {
	sw.mu.RLock()
	defer sw.mu.RUnlock()
	if sw.size == 0 {
		return 0
	}
	return sw.sum / float64(sw.size)
}

// Variance returns the sample variance of the window.
func (sw *SlidingWindow) Variance() float64 {
	sw.mu.RLock()
	defer sw.mu.RUnlock()
	if sw.size < 2 {
		return 0
	}
	mean := sw.sum / float64(sw.size)
	variance := (sw.sumSquares / float64(sw.size)) - (mean * mean)
	if variance < 0 {
		return 0
	}
	return variance
}

// StdDev returns the sample standard deviation.
func (sw *SlidingWindow) StdDev() float64 {
	return math.Sqrt(sw.Variance())
}

// ZScore computes how many standard deviations val is from the current window mean.
func (sw *SlidingWindow) ZScore(val float64) float64 {
	sw.mu.RLock()
	defer sw.mu.RUnlock()
	if sw.size < 5 {
		return 0 // Insufficient samples for statistically sound z-score
	}
	mean := sw.sum / float64(sw.size)
	variance := (sw.sumSquares / float64(sw.size)) - (mean * mean)
	if variance <= 1e-9 {
		return 0
	}
	stdDev := math.Sqrt(variance)
	return math.Abs(val-mean) / stdDev
}

// Percentile calculates the approximate percentile rank (0.0 to 1.0) using snapshot sorting.
func (sw *SlidingWindow) Percentile(p float64) float64 {
	sw.mu.RLock()
	if sw.size == 0 {
		sw.mu.RUnlock()
		return 0
	}
	samples := make([]float64, sw.size)
	copy(samples, sw.buffer[:sw.size])
	sw.mu.RUnlock()

	sort.Float64s(samples)
	if p <= 0 {
		return samples[0]
	}
	if p >= 1.0 {
		return samples[len(samples)-1]
	}
	idx := int(math.Round(float64(len(samples)-1) * p))
	if idx >= len(samples) {
		idx = len(samples) - 1
	}
	return samples[idx]
}

// Min returns the minimum value in the current window.
func (sw *SlidingWindow) Min() float64 {
	sw.mu.RLock()
	defer sw.mu.RUnlock()
	if sw.size == 0 {
		return 0
	}
	minVal := sw.buffer[0]
	for i := 1; i < sw.size; i++ {
		if sw.buffer[i] < minVal {
			minVal = sw.buffer[i]
		}
	}
	return minVal
}

// Max returns the maximum value in the current window.
func (sw *SlidingWindow) Max() float64 {
	sw.mu.RLock()
	defer sw.mu.RUnlock()
	if sw.size == 0 {
		return 0
	}
	maxVal := sw.buffer[0]
	for i := 1; i < sw.size; i++ {
		if sw.buffer[i] > maxVal {
			maxVal = sw.buffer[i]
		}
	}
	return maxVal
}

// GetStats returns full statistical summary of the window.
func (sw *SlidingWindow) GetStats() SlidingWindowStats {
	sw.mu.RLock()
	size := sw.size
	if size == 0 {
		sw.mu.RUnlock()
		return SlidingWindowStats{SampleSize: sw.capacity}
	}
	sum := sw.sum
	sumSquares := sw.sumSquares
	samples := make([]float64, size)
	copy(samples, sw.buffer[:size])
	sw.mu.RUnlock()

	sort.Float64s(samples)
	mean := sum / float64(size)
	variance := 0.0
	if size > 1 {
		variance = (sumSquares / float64(size)) - (mean * mean)
		if variance < 0 {
			variance = 0
		}
	}
	stdDev := math.Sqrt(variance)

	p95Idx := int(math.Round(float64(size-1) * 0.95))
	if p95Idx >= size {
		p95Idx = size - 1
	}

	return SlidingWindowStats{
		Count:      size,
		Mean:       mean,
		Variance:   variance,
		StdDev:     stdDev,
		P95:        samples[p95Idx],
		Min:        samples[0],
		Max:        samples[size-1],
		SampleSize: size,
	}
}

// DetectorConfig defines thresholds and window sizes for the anomaly detector.
type DetectorConfig struct {
	LatencyWindowSize       int     `json:"latencyWindowSize"`
	LatencyThresholdMs      float64 `json:"latencyThresholdMs"`      // e.g. 50.0 ms
	LatencyZThreshold       float64 `json:"latencyZThreshold"`       // e.g. 2.5
	DropOffWindowSize       int     `json:"dropOffWindowSize"`       // e.g. 50 sessions
	DropOffRateThreshold    float64 `json:"dropOffRateThreshold"`    // e.g. 0.15 (15% drop-off = 85% completion)
	DwellWindowSize         int     `json:"dwellWindowSize"`         // e.g. 50 events
	IdleThresholdMs         float64 `json:"idleThresholdMs"`         // e.g. 8000.0 ms
	BacktrackThreshold      int     `json:"backtrackThreshold"`      // e.g. 2 backtracks
	MaxAlertHistoryCapacity int     `json:"maxAlertHistoryCapacity"` // e.g. 200
}

// DefaultDetectorConfig provides production defaults for sub-millisecond audio and UX monitoring.
func DefaultDetectorConfig() DetectorConfig {
	return DetectorConfig{
		LatencyWindowSize:       100,
		LatencyThresholdMs:      50.0,
		LatencyZThreshold:       2.5,
		DropOffWindowSize:       50,
		DropOffRateThreshold:    0.15, // 15% drop off = 85% completion threshold
		DwellWindowSize:         50,
		IdleThresholdMs:         8000.0,
		BacktrackThreshold:      2,
		MaxAlertHistoryCapacity: 200,
	}
}

// AnomalyDetector manages multiple sliding windows and alerts subscribers upon threshold breaches.
type AnomalyDetector struct {
	mu              sync.RWMutex
	cfg             DetectorConfig
	latencyWindow   *SlidingWindow
	dropOffWindow   *SlidingWindow // 1.0 = completed, 0.0 = abandoned
	dwellWindow     *SlidingWindow
	backtrackWindow *SlidingWindow
	alerts          []AnomalyAlert
	alertCounter    uint64

	// WebSocket / Subscriber broadcasting
	subMu       sync.RWMutex
	subscribers map[chan AnomalyAlert]struct{}

	// Embedded HTTP/WebSocket Server
	server   *http.Server
	listener net.Listener
	isClosed atomic.Bool
}

// NewAnomalyDetector constructs an AnomalyDetector with the given configuration.
func NewAnomalyDetector(cfg DetectorConfig) *AnomalyDetector {
	if cfg.LatencyWindowSize <= 0 {
		cfg = DefaultDetectorConfig()
	}
	return &AnomalyDetector{
		cfg:             cfg,
		latencyWindow:   NewSlidingWindow(cfg.LatencyWindowSize),
		dropOffWindow:   NewSlidingWindow(cfg.DropOffWindowSize),
		dwellWindow:     NewSlidingWindow(cfg.DwellWindowSize),
		backtrackWindow: NewSlidingWindow(cfg.DwellWindowSize),
		alerts:          make([]AnomalyAlert, 0, cfg.MaxAlertHistoryCapacity),
		subscribers:     make(map[chan AnomalyAlert]struct{}),
	}
}

// IngestLatencySample evaluates an audio latency sample against rolling statistics and threshold baselines.
func (ad *AnomalyDetector) IngestLatencySample(sample AudioLatencySample) *AnomalyAlert {
	ad.latencyWindow.Push(sample.TotalLatencyMs)

	mean := ad.latencyWindow.Mean()
	stdDev := ad.latencyWindow.StdDev()
	zScore := ad.latencyWindow.ZScore(sample.TotalLatencyMs)

	// Anomaly Condition: Absolute threshold breach OR statistical Z-score outlier
	isBreach := sample.TotalLatencyMs > ad.cfg.LatencyThresholdMs
	isOutlier := zScore > ad.cfg.LatencyZThreshold && sample.TotalLatencyMs > 25.0

	if isBreach || isOutlier {
		severity := SeverityMedium
		if sample.TotalLatencyMs > ad.cfg.LatencyThresholdMs*2.0 {
			severity = SeverityCritical
		} else if isBreach {
			severity = SeverityHigh
		}

		alertID := fmt.Sprintf("lat-alert-%d-%d", time.Now().UnixNano(), atomic.AddUint64(&ad.alertCounter, 1))
		alert := AnomalyAlert{
			ID:                alertID,
			AlertType:         AlertAudioLatencySpike,
			Severity:          severity,
			MetricName:        "audio_processing_latency_ms",
			CurrentValue:      sample.TotalLatencyMs,
			ThresholdValue:    ad.cfg.LatencyThresholdMs,
			SlidingWindowSize: ad.latencyWindow.Count(),
			WindowMean:        mean,
			WindowStdDev:      stdDev,
			ZScore:            zScore,
			Timestamp:         time.Now().UnixMilli(),
			Details:           fmt.Sprintf("Audio latency spike observed: %.2fms (Window Mean: %.2fms, Z-Score: %.2f)", sample.TotalLatencyMs, mean, zScore),
			SuggestedAction:   "Increase audio buffer size, check thread contention, or prioritize audio worker goroutine.",
			Metadata: map[string]interface{}{
				"streamId":        sample.StreamID,
				"frameId":         sample.FrameID,
				"captureLatency":  sample.CaptureLatencyMs,
				"vadLatency":      sample.VADLatencyMs,
				"procLatency":     sample.ProcessingLatencyMs,
				"bufferUnderruns": sample.BufferUnderruns,
			},
		}

		ad.recordAlert(alert)
		return &alert
	}

	return nil
}

// IngestUserInteraction analyzes user events (dwell, backtrack, idle, drop-off) to detect UX friction.
func (ad *AnomalyDetector) IngestUserInteraction(event UserInteractionEvent) *AnomalyAlert {
	now := time.Now().UnixMilli()

	// 1. Dwell & Idle Time Analysis
	if event.DwellTimeMs > 0 {
		ad.dwellWindow.Push(event.DwellTimeMs)
	}

	// 2. Friction Alert: Idle Timeout Breached
	if event.IdleDurationMs >= ad.cfg.IdleThresholdMs {
		alertID := fmt.Sprintf("fric-idle-%d-%d", now, atomic.AddUint64(&ad.alertCounter, 1))
		alert := AnomalyAlert{
			ID:                alertID,
			AlertType:         AlertUserFrictionHigh,
			Severity:          SeverityMedium,
			MetricName:        "user_idle_duration_ms",
			CurrentValue:      event.IdleDurationMs,
			ThresholdValue:    ad.cfg.IdleThresholdMs,
			SlidingWindowSize: ad.dwellWindow.Count(),
			Timestamp:         now,
			Details:           fmt.Sprintf("User stalled at step '%s' for %.1fs without interaction.", event.StepID, event.IdleDurationMs/1000.0),
			SuggestedAction:   "Activate simplified onboarding mode with auto-detected audio settings.",
			Metadata: map[string]interface{}{
				"stepId":    event.StepID,
				"sessionId": event.SessionID,
			},
		}
		ad.recordAlert(alert)
		return &alert
	}

	// 3. Friction Alert: Excessive Backtracking
	if event.BacktrackCount >= ad.cfg.BacktrackThreshold {
		ad.backtrackWindow.Push(float64(event.BacktrackCount))
		alertID := fmt.Sprintf("fric-backtrack-%d-%d", now, atomic.AddUint64(&ad.alertCounter, 1))
		alert := AnomalyAlert{
			ID:                alertID,
			AlertType:         AlertExcessiveBacktracking,
			Severity:          SeverityHigh,
			MetricName:        "step_backtrack_count",
			CurrentValue:      float64(event.BacktrackCount),
			ThresholdValue:    float64(ad.cfg.BacktrackThreshold),
			SlidingWindowSize: ad.backtrackWindow.Count(),
			Timestamp:         now,
			Details:           fmt.Sprintf("User backtracked %d times during step '%s', indicating decision paralysis or confusing UI.", event.BacktrackCount, event.StepID),
			SuggestedAction:   "Offer smart defaults and collapse technical audio parameters.",
			Metadata: map[string]interface{}{
				"stepId":    event.StepID,
				"sessionId": event.SessionID,
			},
		}
		ad.recordAlert(alert)
		return &alert
	}

	// 4. Drop-off Recording: Step Complete vs Abandon
	if event.EventType == "step_complete" {
		ad.dropOffWindow.Push(1.0)
	} else if event.EventType == "abandon" || event.EventType == "error" {
		ad.dropOffWindow.Push(0.0)
		return ad.checkDropOffRate()
	}

	return nil
}

// checkDropOffRate computes current drop-off rate and returns an alert if it exceeds threshold.
func (ad *AnomalyDetector) checkDropOffRate() *AnomalyAlert {
	if ad.dropOffWindow.Count() < 5 {
		return nil
	}

	completionRate := ad.dropOffWindow.Mean()
	dropOffRate := 1.0 - completionRate

	if dropOffRate > ad.cfg.DropOffRateThreshold {
		alertID := fmt.Sprintf("drop-alert-%d-%d", time.Now().UnixMilli(), atomic.AddUint64(&ad.alertCounter, 1))
		alert := AnomalyAlert{
			ID:                alertID,
			AlertType:         AlertHighDropOffRate,
			Severity:          SeverityCritical,
			MetricName:        "onboarding_drop_off_rate",
			CurrentValue:      dropOffRate,
			ThresholdValue:    ad.cfg.DropOffRateThreshold,
			SlidingWindowSize: ad.dropOffWindow.Count(),
			Timestamp:         time.Now().UnixMilli(),
			Details:           fmt.Sprintf("Onboarding drop-off rate surged to %.1f%% (Completion rate: %.1f%%, Target >= %.1f%%).", dropOffRate*100.0, completionRate*100.0, (1.0-ad.cfg.DropOffRateThreshold)*100.0),
			SuggestedAction:   "Simplify onboarding flow, eliminate permission friction, and verify microphone availability.",
			Metadata: map[string]interface{}{
				"completionRate": completionRate,
				"sampleCount":    ad.dropOffWindow.Count(),
			},
		}
		ad.recordAlert(alert)
		return &alert
	}
	return nil
}

// EvaluateDropOffRate calculates the active completion rate and emits an alert if below threshold.
func (ad *AnomalyDetector) EvaluateDropOffRate() (float64, *AnomalyAlert) {
	completionRate := ad.dropOffWindow.Mean()
	alert := ad.checkDropOffRate()
	return completionRate, alert
}

// recordAlert stores the alert in in-memory history and notifies all active WebSocket subscribers.
func (ad *AnomalyDetector) recordAlert(alert AnomalyAlert) {
	ad.mu.Lock()
	if len(ad.alerts) >= ad.cfg.MaxAlertHistoryCapacity {
		ad.alerts = ad.alerts[1:] // Maintain FIFO ring buffer
	}
	ad.alerts = append(ad.alerts, alert)
	ad.mu.Unlock()

	// Broadcast non-blocking to active WebSocket subscribers
	ad.subMu.RLock()
	for ch := range ad.subscribers {
		select {
		case ch <- alert:
		default:
			// Buffer full, skip subscriber to avoid stalling the detector
		}
	}
	ad.subMu.RUnlock()
}

// Subscribe returns a channel that receives live AnomalyAlert instances.
func (ad *AnomalyDetector) Subscribe() (chan AnomalyAlert, func()) {
	ch := make(chan AnomalyAlert, 64)
	ad.subMu.Lock()
	ad.subscribers[ch] = struct{}{}
	ad.subMu.Unlock()

	unsubscribe := func() {
		ad.subMu.Lock()
		delete(ad.subscribers, ch)
		ad.subMu.Unlock()
		close(ch)
	}
	return ch, unsubscribe
}

// GetAlertHistory returns a copy of recently recorded anomaly alerts.
func (ad *AnomalyDetector) GetAlertHistory() []AnomalyAlert {
	ad.mu.RLock()
	defer ad.mu.RUnlock()
	copied := make([]AnomalyAlert, len(ad.alerts))
	copy(copied, ad.alerts)
	return copied
}

// GetWindowStats retrieves rolling statistics for a named metric.
func (ad *AnomalyDetector) GetWindowStats(metric string) SlidingWindowStats {
	switch strings.ToLower(metric) {
	case "latency", "audio_latency":
		return ad.latencyWindow.GetStats()
	case "dwell", "dwell_time":
		return ad.dwellWindow.GetStats()
	case "dropoff", "drop_off", "completion":
		return ad.dropOffWindow.GetStats()
	case "backtrack":
		return ad.backtrackWindow.GetStats()
	default:
		return ad.latencyWindow.GetStats()
	}
}

// Reset clears all sliding windows and alert histories.
func (ad *AnomalyDetector) Reset() {
	ad.mu.Lock()
	ad.alerts = ad.alerts[:0]
	ad.latencyWindow = NewSlidingWindow(ad.cfg.LatencyWindowSize)
	ad.dropOffWindow = NewSlidingWindow(ad.cfg.DropOffWindowSize)
	ad.dwellWindow = NewSlidingWindow(ad.cfg.DwellWindowSize)
	ad.backtrackWindow = NewSlidingWindow(ad.cfg.DwellWindowSize)
	ad.mu.Unlock()
}

// -----------------------------------------------------------------------------
// Zero-Dependency RFC 6455 WebSocket & Streaming HTTP Server
// -----------------------------------------------------------------------------

// Handler returns an http.Handler configured with all analytics endpoints.
func (ad *AnomalyDetector) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/analytics/ws", ad.handleWebSocket)
	mux.HandleFunc("/analytics/metrics", ad.handleMetricsHTTP)
	mux.HandleFunc("/analytics/alerts", ad.handleAlertsHTTP)
	mux.HandleFunc("/analytics/status", ad.handleStatusHTTP)
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"status":    "healthy",
			"timestamp": time.Now().UnixMilli(),
		})
	})
	return mux
}

// StartServer binds a local HTTP & WebSocket server for IPC with Electron.
func (ad *AnomalyDetector) StartServer(addr string) error {
	if addr == "" {
		addr = "127.0.0.1:9095"
	}

	listener, err := net.Listen("tcp", addr)
	if err != nil {
		return fmt.Errorf("failed to listen on %s: %w", addr, err)
	}

	ad.listener = listener
	ad.server = &http.Server{Handler: ad.Handler()}

	go func() {
		_ = ad.server.Serve(listener)
	}()

	return nil
}

// Addr returns the bound address of the server, useful when port 0 is used for testing.
func (ad *AnomalyDetector) Addr() string {
	if ad.listener != nil {
		return ad.listener.Addr().String()
	}
	return ""
}

// StopServer gracefully terminates the analytics server.
func (ad *AnomalyDetector) StopServer() error {
	ad.isClosed.Store(true)
	if ad.server != nil {
		return ad.server.Close()
	}
	return nil
}

// handleStatusHTTP emits current sliding window statistics in JSON.
func (ad *AnomalyDetector) handleStatusHTTP(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	status := map[string]interface{}{
		"latencyStats":   ad.latencyWindow.GetStats(),
		"dropOffStats":   ad.dropOffWindow.GetStats(),
		"dwellStats":     ad.dwellWindow.GetStats(),
		"backtrackStats": ad.backtrackWindow.GetStats(),
		"activeAlerts":   len(ad.alerts),
		"timestamp":      time.Now().UnixMilli(),
	}
	_ = json.NewEncoder(w).Encode(status)
}

// handleAlertsHTTP returns recent anomaly alerts in JSON.
func (ad *AnomalyDetector) handleAlertsHTTP(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(ad.GetAlertHistory())
}

// handleMetricsHTTP handles batched ingestion over standard HTTP POST.
func (ad *AnomalyDetector) handleMetricsHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}

	var payload struct {
		LatencySamples []AudioLatencySample   `json:"latencySamples"`
		UserEvents     []UserInteractionEvent `json:"userEvents"`
	}

	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, "Invalid JSON: "+err.Error(), http.StatusBadRequest)
		return
	}

	alerts := make([]AnomalyAlert, 0)
	for _, sample := range payload.LatencySamples {
		if alert := ad.IngestLatencySample(sample); alert != nil {
			alerts = append(alerts, *alert)
		}
	}
	for _, ev := range payload.UserEvents {
		if alert := ad.IngestUserInteraction(ev); alert != nil {
			alerts = append(alerts, *alert)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"ingestedLatency": len(payload.LatencySamples),
		"ingestedEvents":  len(payload.UserEvents),
		"alertsTriggered": alerts,
	})
}

// handleWebSocket upgrades incoming HTTP connections to RFC 6455 WebSocket.
func (ad *AnomalyDetector) handleWebSocket(w http.ResponseWriter, r *http.Request) {
	if strings.ToLower(r.Header.Get("Upgrade")) != "websocket" {
		http.Error(w, "Expected WebSocket Upgrade", http.StatusBadRequest)
		return
	}

	secKey := r.Header.Get("Sec-WebSocket-Key")
	if secKey == "" {
		http.Error(w, "Missing Sec-WebSocket-Key", http.StatusBadRequest)
		return
	}

	// Compute RFC 6455 Sec-WebSocket-Accept hash
	h := sha1.New()
	h.Write([]byte(secKey + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"))
	acceptKey := base64.StdEncoding.EncodeToString(h.Sum(nil))

	hijacker, ok := w.(http.Hijacker)
	if !ok {
		http.Error(w, "Webserver doesn't support hijacking", http.StatusInternalServerError)
		return
	}

	conn, bufrw, err := hijacker.Hijack()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer conn.Close()

	// Write HTTP 101 Switching Protocols response
	resp := "HTTP/1.1 101 Switching Protocols\r\n" +
		"Upgrade: websocket\r\n" +
		"Connection: Upgrade\r\n" +
		"Sec-WebSocket-Accept: " + acceptKey + "\r\n\r\n"
	if _, err := bufrw.WriteString(resp); err != nil {
		return
	}
	if err := bufrw.Flush(); err != nil {
		return
	}

	// Subscribe to live anomaly alerts
	alertCh, unsub := ad.Subscribe()
	defer unsub()

	// Writer goroutine: sends alerts to client
	writeDone := make(chan struct{})
	go func() {
		defer close(writeDone)
		for alert := range alertCh {
			data, err := json.Marshal(map[string]interface{}{
				"type":      "anomaly_alert",
				"payload":   alert,
				"timestamp": time.Now().UnixMilli(),
			})
			if err != nil {
				continue
			}
			if err := writeWSFrame(conn, 0x1, data); err != nil {
				return
			}
		}
	}()

	// Reader loop: ingests client metrics over WebSocket
	reader := bufio.NewReader(conn)
	for {
		if ad.isClosed.Load() {
			break
		}
		opcode, payload, err := readWSFrame(reader)
		if err != nil {
			break
		}

		if opcode == 0x8 { // Close frame
			_ = writeWSFrame(conn, 0x8, nil)
			break
		} else if opcode == 0x9 { // Ping frame
			_ = writeWSFrame(conn, 0xA, payload) // Pong
			continue
		} else if opcode == 0x1 { // Text JSON frame
			var msg struct {
				Type           string                 `json:"type"`
				LatencySamples []AudioLatencySample   `json:"latencySamples"`
				UserEvents     []UserInteractionEvent `json:"userEvents"`
			}
			if err := json.Unmarshal(payload, &msg); err == nil {
				for _, sample := range msg.LatencySamples {
					ad.IngestLatencySample(sample)
				}
				for _, ev := range msg.UserEvents {
					ad.IngestUserInteraction(ev)
				}
			}
		}
	}
}

// writeWSFrame encodes an unmasked WebSocket frame to client.
func writeWSFrame(w io.Writer, opcode byte, payload []byte) error {
	length := len(payload)
	header := []byte{0x80 | (opcode & 0x0F)}

	if length <= 125 {
		header = append(header, byte(length))
	} else if length <= 65535 {
		header = append(header, 126)
		ext := make([]byte, 2)
		binary.BigEndian.PutUint16(ext, uint16(length))
		header = append(header, ext...)
	} else {
		header = append(header, 127)
		ext := make([]byte, 8)
		binary.BigEndian.PutUint64(ext, uint64(length))
		header = append(header, ext...)
	}

	if _, err := w.Write(header); err != nil {
		return err
	}
	if length > 0 {
		_, err := w.Write(payload)
		return err
	}
	return nil
}

// readWSFrame decodes a masked client WebSocket frame.
func readWSFrame(r *bufio.Reader) (byte, []byte, error) {
	b0, err := r.ReadByte()
	if err != nil {
		return 0, nil, err
	}
	opcode := b0 & 0x0F

	b1, err := r.ReadByte()
	if err != nil {
		return 0, nil, err
	}
	isMasked := (b1 & 0x80) != 0
	length := uint64(b1 & 0x7F)

	if length == 126 {
		var ext uint16
		if err := binary.Read(r, binary.BigEndian, &ext); err != nil {
			return 0, nil, err
		}
		length = uint64(ext)
	} else if length == 127 {
		if err := binary.Read(r, binary.BigEndian, &length); err != nil {
			return 0, nil, err
		}
	}

	var mask [4]byte
	if isMasked {
		if _, err := io.ReadFull(r, mask[:]); err != nil {
			return 0, nil, err
		}
	}

	payload := make([]byte, length)
	if _, err := io.ReadFull(r, payload); err != nil {
		return 0, nil, err
	}

	if isMasked {
		for i := range payload {
			payload[i] ^= mask[i%4]
		}
	}

	return opcode, payload, nil
}

// ErrInvalidMetricSample is returned when an invalid metric sample is passed.
var ErrInvalidMetricSample = errors.New("invalid or empty metric sample")
