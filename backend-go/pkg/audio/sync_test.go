package audio

import (
	"sync"
	"testing"
	"time"
)

func TestClockSynchronizer_DefaultsAndInitialization(t *testing.T) {
	// Test with default config
	syncDef := NewClockSynchronizer()
	if syncDef == nil {
		t.Fatal("expected non-nil synchronizer with default config")
	}
	if state := syncDef.GetState(); state != SyncStateInSync {
		t.Fatalf("expected initial state %s, got %s", SyncStateInSync, state)
	}
	if drift := syncDef.GetDriftUs(); drift != 0 {
		t.Fatalf("expected initial drift 0, got %d", drift)
	}

	// Test with zeroed/invalid config values that trigger fallbacks
	badCfg := ClockSyncConfig{
		TargetFPS:         0,
		SampleRate:        0,
		DriftThresholdUs:  0,
		MaxAllowedDriftUs: 0,
		JitterWindowSize:  0,
	}
	syncCustom := NewClockSynchronizer(badCfg)
	if syncCustom == nil {
		t.Fatal("expected non-nil synchronizer with fallback config")
	}
	if syncCustom.cfg.TargetFPS != 60.0 {
		t.Fatalf("expected TargetFPS 60.0, got %f", syncCustom.cfg.TargetFPS)
	}
	if syncCustom.cfg.SampleRate != 48000 {
		t.Fatalf("expected SampleRate 48000, got %d", syncCustom.cfg.SampleRate)
	}
	if syncCustom.cfg.DriftThresholdUs != 10000 {
		t.Fatalf("expected DriftThresholdUs 10000, got %d", syncCustom.cfg.DriftThresholdUs)
	}
	if syncCustom.cfg.MaxAllowedDriftUs != 50000 {
		t.Fatalf("expected MaxAllowedDriftUs 50000, got %d", syncCustom.cfg.MaxAllowedDriftUs)
	}
	if syncCustom.cfg.JitterWindowSize != 16 {
		t.Fatalf("expected JitterWindowSize 16, got %d", syncCustom.cfg.JitterWindowSize)
	}
}

func TestClockSynchronizer_DriftCalculationStates(t *testing.T) {
	cfg := ClockSyncConfig{
		TargetFPS:         60.0,
		SampleRate:        48000,
		DriftThresholdUs:  5000,  // 5ms
		MaxAllowedDriftUs: 30000, // 30ms
		JitterWindowSize:  4,
	}
	syncer := NewClockSynchronizer(cfg)

	baseTime := time.Now().UnixNano()

	// Initially, updating visual without audio should return early without error
	syncer.RecordVisualFrame(baseTime)
	if state := syncer.GetState(); state != SyncStateInSync {
		t.Fatalf("expected InSync before audio samples, got %s", state)
	}
	syncer.Reset()

	// Case 1: In Sync
	// 48000 Hz / 60 FPS = 800 samples per visual frame
	for i := 0; i < 60; i++ {
		tNs := baseTime + int64(float64(i)*(1e9/60.0))
		syncer.RecordAudioSamples(800, tNs)
		syncer.RecordVisualFrame(tNs)
	}
	if state := syncer.GetState(); state != SyncStateInSync {
		t.Fatalf("expected InSync for matched rate, got %s (drift: %d us)", state, syncer.GetDriftUs())
	}

	metrics := syncer.GetMetrics()
	if metrics.State != SyncStateInSync {
		t.Fatalf("expected metrics State InSync, got %s", metrics.State)
	}
	if metrics.AverageJitterUs < 0 {
		t.Fatalf("expected AverageJitterUs >= 0, got %d", metrics.AverageJitterUs)
	}

	// Case 2: Audio Lead (820 samples per 60fps frame -> 25ms lead, threshold is 5ms..30ms)
	leadSyncer := NewClockSynchronizer(cfg)
	leadBase := time.Now().UnixNano()
	for i := 0; i < 60; i++ {
		tNs := leadBase + int64(float64(i)*(1e9/60.0))
		leadSyncer.RecordAudioSamples(820, tNs)
		leadSyncer.RecordVisualFrame(tNs)
	}
	leadState := leadSyncer.GetState()
	if leadState != SyncStateLead {
		t.Fatalf("expected Lead, got %s (drift: %d us)", leadState, leadSyncer.GetDriftUs())
	}

	// Case 3: Audio Lag (780 samples per 60fps frame -> -25ms lag, threshold is -5ms..-30ms)
	lagSyncer := NewClockSynchronizer(cfg)
	lagBase := time.Now().UnixNano()
	for i := 0; i < 60; i++ {
		tNs := lagBase + int64(float64(i)*(1e9/60.0))
		lagSyncer.RecordAudioSamples(780, tNs)
		lagSyncer.RecordVisualFrame(tNs)
	}
	lagState := lagSyncer.GetState()
	if lagState != SyncStateLag {
		t.Fatalf("expected Lag, got %s (drift: %d us)", lagState, lagSyncer.GetDriftUs())
	}

	// Case 4: Audio Recalibrating (900 samples per 60fps frame -> +125ms drift > 30ms MaxAllowedDriftUs)
	recalSyncer := NewClockSynchronizer(cfg)
	recalBase := time.Now().UnixNano()
	for i := 0; i < 60; i++ {
		tNs := recalBase + int64(float64(i)*(1e9/60.0))
		recalSyncer.RecordAudioSamples(900, tNs)
		recalSyncer.RecordVisualFrame(tNs)
	}
	recalState := recalSyncer.GetState()
	if recalState != SyncStateRecalibrating {
		t.Fatalf("expected Recalibrating, got %s (drift: %d us)", recalState, recalSyncer.GetDriftUs())
	}
}

func TestClockSynchronizer_AlignFrame(t *testing.T) {
	cfg := ClockSyncConfig{
		TargetFPS:         60.0,
		SampleRate:        48000,
		DriftThresholdUs:  5000,
		MaxAllowedDriftUs: 40000,
		JitterWindowSize:  4,
	}
	syncer := NewClockSynchronizer(cfg)

	// AlignFrame with nil frame should return 0, SyncStateInSync safely
	correction, state := syncer.AlignFrame(nil)
	if correction != 0 || state != SyncStateInSync {
		t.Fatalf("expected (0, InSync) on nil frame, got (%d, %s)", correction, state)
	}

	// Frame in sync
	frame := &AudioFrame{
		TimestampNs: time.Now().UnixNano(),
		Data:        make([]byte, 1920), // 960 samples
	}
	correction, state = syncer.AlignFrame(frame)
	if correction != 0 || state != SyncStateInSync {
		t.Fatalf("expected 0 correction when in-sync, got %d, state=%s", correction, state)
	}
	if frame.TimestampNs == 0 {
		t.Fatal("expected frame TimestampNs to be populated with PTS")
	}

	// Test dampening and micro-adjustment when in Lead state
	syncer.driftUs.Store(10000) // 10ms lead
	leadStateStr := string(SyncStateLead)
	syncer.stateStr.Store(&leadStateStr)

	frame2 := &AudioFrame{
		TimestampNs: time.Now().UnixNano(),
		Data:        make([]byte, 1920), // 960 samples, maxAdjustment = 960/20 = 48
	}
	correction, state = syncer.AlignFrame(frame2)
	if state != SyncStateLead {
		t.Fatalf("expected state %s, got %s", SyncStateLead, state)
	}
	if correction <= 0 || correction > 48 {
		t.Fatalf("expected clamped correction between 1 and 48, got %d", correction)
	}

	// Test small frame clamp (maxAdjustment < 1 fallback to 1)
	smallFrame := &AudioFrame{
		TimestampNs: time.Now().UnixNano(),
		Data:        make([]byte, 10), // 5 samples -> 5/20 = 0 -> clamped to 1
	}
	correction, _ = syncer.AlignFrame(smallFrame)
	if correction != 1 {
		t.Fatalf("expected correction 1 for small frame, got %d", correction)
	}

	// Test negative drift (Lag state)
	syncer.driftUs.Store(-15000) // -15ms lag
	lagStateStr := string(SyncStateLag)
	syncer.stateStr.Store(&lagStateStr)

	correction, state = syncer.AlignFrame(frame2)
	if state != SyncStateLag {
		t.Fatalf("expected state %s, got %s", SyncStateLag, state)
	}
	if correction >= 0 || correction < -48 {
		t.Fatalf("expected negative clamped correction between -48 and -1, got %d", correction)
	}

	// Test Recalibrating state triggers hard re-anchor
	recalStateStr := string(SyncStateRecalibrating)
	syncer.stateStr.Store(&recalStateStr)
	correction, state = syncer.AlignFrame(frame2)
	if correction != 0 {
		t.Fatalf("expected 0 correction on recalibration, got %d", correction)
	}
	if state != SyncStateInSync {
		t.Fatalf("expected state to return to InSync after recalibration, got %s", state)
	}
}

func TestClockSynchronizer_Reset(t *testing.T) {
	syncer := NewClockSynchronizer()
	syncer.RecordAudioSamples(96000, 1000)
	syncer.RecordVisualFrame(1000)
	syncer.driftUs.Store(12345)
	syncer.corrections.Store(42)

	syncer.Reset()

	if syncer.GetDriftUs() != 0 {
		t.Fatalf("expected drift 0 after reset, got %d", syncer.GetDriftUs())
	}
	if syncer.GetState() != SyncStateInSync {
		t.Fatalf("expected state InSync after reset, got %s", syncer.GetState())
	}
	metrics := syncer.GetMetrics()
	if metrics.DriftCorrections != 0 {
		t.Fatalf("expected 0 corrections after reset, got %d", metrics.DriftCorrections)
	}
}

func TestClockSynchronizer_RecordAudioSamples_TimestampZero(t *testing.T) {
	syncer := NewClockSynchronizer()
	// Test RecordAudioSamples with timestampNs <= 0
	pts := syncer.RecordAudioSamples(960, 0)
	if pts <= 0 {
		t.Fatalf("expected positive PTS, got %d", pts)
	}

	// Test RecordVisualFrame with timestampNs <= 0
	syncer.RecordVisualFrame(0)
	if syncer.lastVisualNs <= 0 {
		t.Fatal("expected positive lastVisualNs")
	}
}

func TestClockSynchronizer_ConcurrencyAndRace(t *testing.T) {
	syncer := NewClockSynchronizer(ClockSyncConfig{
		TargetFPS:         60.0,
		SampleRate:        48000,
		DriftThresholdUs:  5000,
		MaxAllowedDriftUs: 50000,
		JitterWindowSize:  16,
	})

	var wg sync.WaitGroup
	numWorkers := 10
	iterations := 200

	// 10 concurrent goroutines recording audio samples, visual frames, aligning frames, and reading metrics
	for i := 0; i < numWorkers; i++ {
		wg.Add(1)
		go func(workerID int) {
			defer wg.Done()
			base := time.Now().UnixNano()
			for j := 0; j < iterations; j++ {
				syncer.RecordAudioSamples(480, base+int64(j*10*1e6))
				if j%2 == 0 {
					syncer.RecordVisualFrame(base + int64(j*10*1e6))
				}
				frame := &AudioFrame{
					TimestampNs: base + int64(j*10*1e6),
					Data:        make([]byte, 960),
				}
				_, _ = syncer.AlignFrame(frame)
				_ = syncer.GetState()
				_ = syncer.GetDriftUs()
				_ = syncer.GetMetrics()
			}
		}(i)
	}

	wg.Wait()

	metrics := syncer.GetMetrics()
	if metrics.DriftCorrections < 0 {
		t.Fatal("invalid drift corrections")
	}
}
