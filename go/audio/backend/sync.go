// Package backend provides thread-safe audio clock synchronization primitives,
// drift compensation, and lightweight RPC endpoints for WebWorker communication.
package backend

import (
	"encoding/json"
	"errors"
	"net/http"
	"sync"
	"sync/atomic"
	"time"
)

// SyncState represents the alignment state between audio presentation times and visual display refresh.
type SyncState string

const (
	SyncStateInSync        SyncState = "in-sync"
	SyncStateLead          SyncState = "lead"
	SyncStateLag           SyncState = "lag"
	SyncStateRecalibrating SyncState = "recalibrating"
)

// DriftMetrics reports real-time synchronization telemetry and clock offsets.
type DriftMetrics struct {
	ClockDriftUs            int64     `json:"clockDriftUs"`
	AudioPresentationTimeNs int64     `json:"audioPresentationTimeNs"`
	VisualTimestampNs       int64     `json:"visualTimestampNs"`
	DriftCorrections        uint64    `json:"driftCorrections"`
	State                   SyncState `json:"state"`
	SampleOffsetCorrection  int       `json:"sampleOffsetCorrection"`
	AverageJitterUs         int64     `json:"averageJitterUs"`
	SynchronizedAt          int64     `json:"synchronizedAt"`
}

// ForceSyncRequest represents the incoming payload from Electron or WebWorker thread.
type ForceSyncRequest struct {
	ClientTimestampNs int64         `json:"clientTimestampNs"`
	SampleRate        uint32        `json:"sampleRate"`
	Metrics           *DriftMetrics `json:"metrics,omitempty"`
}

// ForceSyncResponse represents the atomic synchronization outcome returned to client.
type ForceSyncResponse struct {
	Success           bool          `json:"success"`
	Metrics           *DriftMetrics `json:"metrics"`
	ServerTimestampNs int64         `json:"serverTimestampNs"`
	Error             string        `json:"error,omitempty"`
}

// Synchronizer coordinates clock alignments across the Go audio engine and Electron front-end.
type Synchronizer struct {
	mu                 sync.RWMutex
	baseAudioNs        int64
	baseVisualNs       int64
	sampleRate         uint32
	driftCorrections   atomic.Uint64
	currentDriftUs     atomic.Int64
	currentState       atomic.Pointer[string]
	lastSyncTimestamp  atomic.Int64
}

// NewSynchronizer initializes an active Synchronizer with default parameters.
func NewSynchronizer(sampleRate ...uint32) *Synchronizer {
	sr := uint32(48000)
	if len(sampleRate) > 0 && sampleRate[0] > 0 {
		sr = sampleRate[0]
	}

	now := time.Now().UnixNano()
	s := &Synchronizer{
		baseAudioNs:  now,
		baseVisualNs: now,
		sampleRate:   sr,
	}

	initialState := string(SyncStateInSync)
	s.currentState.Store(&initialState)
	s.lastSyncTimestamp.Store(time.Now().UnixMilli())

	return s
}

// ForceSync performs an immediate thread-safe clock recalibration and baseline re-anchor.
func (s *Synchronizer) ForceSync(clientTsNs int64, sampleRate uint32) (*DriftMetrics, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	now := time.Now()
	nowNs := now.UnixNano()

	if sampleRate > 0 {
		s.sampleRate = sampleRate
	}

	// Re-anchor presentation baselines
	s.baseAudioNs = nowNs
	s.baseVisualNs = nowNs
	if clientTsNs > 0 {
		s.baseVisualNs = clientTsNs
	}

	s.currentDriftUs.Store(0)
	s.driftCorrections.Add(1)
	s.lastSyncTimestamp.Store(now.UnixMilli())

	inSync := string(SyncStateInSync)
	s.currentState.Store(&inSync)

	metrics := &DriftMetrics{
		ClockDriftUs:            0,
		AudioPresentationTimeNs: nowNs,
		VisualTimestampNs:       s.baseVisualNs,
		DriftCorrections:        s.driftCorrections.Load(),
		State:                   SyncStateInSync,
		SampleOffsetCorrection:  0,
		AverageJitterUs:         0,
		SynchronizedAt:          now.UnixMilli(),
	}

	return metrics, nil
}

// ForceSyncRPC handles structured RPC calls from worker threads or IPC bridges.
func (s *Synchronizer) ForceSyncRPC(req *ForceSyncRequest) (*ForceSyncResponse, error) {
	if req == nil {
		return &ForceSyncResponse{
			Success:           false,
			ServerTimestampNs: time.Now().UnixNano(),
			Error:             "request payload cannot be nil",
		}, errors.New("request payload cannot be nil")
	}

	metrics, err := s.ForceSync(req.ClientTimestampNs, req.SampleRate)
	if err != nil {
		return &ForceSyncResponse{
			Success:           false,
			ServerTimestampNs: time.Now().UnixNano(),
			Error:             err.Error(),
		}, err
	}

	return &ForceSyncResponse{
		Success:           true,
		Metrics:           metrics,
		ServerTimestampNs: time.Now().UnixNano(),
	}, nil
}

// HandleForceSync exposes a lightweight HTTP REST/RPC endpoint for WebWorkers.
func (s *Synchronizer) HandleForceSync(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}

	var req ForceSyncRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil && r.ContentLength > 0 {
		http.Error(w, "Bad Request: invalid JSON", http.StatusBadRequest)
		return
	}

	resp, err := s.ForceSyncRPC(&req)
	w.Header().Set("Content-Type", "application/json")
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
	} else {
		w.WriteHeader(http.StatusOK)
	}

	_ = json.NewEncoder(w).Encode(resp)
}

// GetMetrics returns a point-in-time telemetry snapshot.
func (s *Synchronizer) GetMetrics() DriftMetrics {
	s.mu.RLock()
	defer s.mu.RUnlock()

	stateStr := SyncStateInSync
	if ptr := s.currentState.Load(); ptr != nil {
		stateStr = SyncState(*ptr)
	}

	return DriftMetrics{
		ClockDriftUs:            s.currentDriftUs.Load(),
		AudioPresentationTimeNs: s.baseAudioNs,
		VisualTimestampNs:       s.baseVisualNs,
		DriftCorrections:        s.driftCorrections.Load(),
		State:                   stateStr,
		AverageJitterUs:         0,
		SynchronizedAt:          s.lastSyncTimestamp.Load(),
	}
}

// Reset re-initializes all synchronization accumulators.
func (s *Synchronizer) Reset() {
	s.mu.Lock()
	defer s.mu.Unlock()

	now := time.Now().UnixNano()
	s.baseAudioNs = now
	s.baseVisualNs = now
	s.currentDriftUs.Store(0)
	s.driftCorrections.Store(0)

	inSync := string(SyncStateInSync)
	s.currentState.Store(&inSync)
	s.lastSyncTimestamp.Store(time.Now().UnixMilli())
}
