package audio

import (
	"errors"
	"runtime"
	"sync"
	"testing"
)

func TestLocaleManager_BasicSwitching(t *testing.T) {
	mgr := NewLocaleManager(LocaleEN)

	curr := mgr.GetActiveLocale()
	if curr.Locale != LocaleEN {
		t.Fatalf("expected initial locale %s, got %s", LocaleEN, curr.Locale)
	}

	// Switch to Bengali
	cfg, err := mgr.SetLocale(string(LocaleBN))
	if err != nil {
		t.Fatalf("unexpected error switching to %s: %v", LocaleBN, err)
	}
	if cfg.Locale != LocaleBN {
		t.Fatalf("expected active locale %s, got %s", LocaleBN, cfg.Locale)
	}
	if cfg.STT.LanguageCode != "bn" {
		t.Fatalf("expected STT language 'bn', got '%s'", cfg.STT.LanguageCode)
	}

	// Switch to Banglish
	cfg, err = mgr.SetLocale(string(LocaleBanglish))
	if err != nil {
		t.Fatalf("unexpected error switching to %s: %v", LocaleBanglish, err)
	}
	if !cfg.TTS.RequiresTransliteration {
		t.Fatalf("expected Banglish TTS to require transliteration")
	}
	if cfg.TTS.VoiceName != "en-US-AndrewNeural" {
		t.Fatalf("expected Banglish TTS voice to be en-US-AndrewNeural, got %s", cfg.TTS.VoiceName)
	}
}

func TestLocaleManager_FallbackGracefulDegradation(t *testing.T) {
	mgr := NewLocaleManager(LocaleEN)

	// Attempt to set an unsupported language
	cfg, err := mgr.SetLocale("xx-UNKNOWN")
	if err == nil {
		t.Fatalf("expected error for unsupported locale, got nil")
	}
	if !errors.Is(err, ErrUnsupportedLocale) {
		t.Fatalf("expected ErrUnsupportedLocale, got %v", err)
	}

	// Verify fallback to DefaultLocale (en-US)
	if cfg.Locale != DefaultLocale {
		t.Fatalf("expected fallback to %s, got %s", DefaultLocale, cfg.Locale)
	}

	telemetry := mgr.GetTelemetrySnapshot()
	if telemetry.FailedSwitches != 1 {
		t.Fatalf("expected 1 failed switch in telemetry, got %d", telemetry.FailedSwitches)
	}
}

func TestLocaleManager_ConcurrentSafety(t *testing.T) {
	mgr := NewLocaleManager(LocaleEN)
	const numGoroutines = 120
	const iterationsPerGoroutine = 50

	locales := []string{
		string(LocaleEN),
		string(LocaleBN),
		string(LocaleBanglish),
		string(LocaleHI),
		string(LocaleHinglish),
		"unsupported-dialect",
	}

	var wg sync.WaitGroup
	wg.Add(numGoroutines * 2)

	// Concurrently invoke SetLocale
	for i := 0; i < numGoroutines; i++ {
		go func(id int) {
			defer wg.Done()
			for j := 0; j < iterationsPerGoroutine; j++ {
				loc := locales[(id+j)%len(locales)]
				_, _ = mgr.SetLocale(loc)
			}
		}(i)
	}

	// Concurrently read GetActiveLocale
	for i := 0; i < numGoroutines; i++ {
		go func(id int) {
			defer wg.Done()
			for j := 0; j < iterationsPerGoroutine; j++ {
				cfg := mgr.GetActiveLocale()
				if cfg.Locale == "" {
					t.Errorf("received empty locale during concurrent read")
				}
			}
		}(i)
	}

	wg.Wait()

	telemetry := mgr.GetTelemetrySnapshot()
	if telemetry.SwitchesTotal == 0 {
		t.Fatalf("expected non-zero switch count after concurrent stress test")
	}
}

func TestLocaleManager_ListenerNotification(t *testing.T) {
	mgr := NewLocaleManager(LocaleEN)

	var listenerCalled bool
	var capturedPrev, capturedNext Locale

	mgr.AddListener(func(prev, next LocaleConfig) {
		listenerCalled = true
		capturedPrev = prev.Locale
		capturedNext = next.Locale
	})

	_, err := mgr.SetLocale(string(LocaleHI))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if !listenerCalled {
		t.Fatalf("expected listener to be invoked on locale change")
	}
	if capturedPrev != LocaleEN || capturedNext != LocaleHI {
		t.Fatalf("expected transition %s -> %s, got %s -> %s", LocaleEN, LocaleHI, capturedPrev, capturedNext)
	}
}

func TestLocaleManager_ZeroMemoryLeakOnRapidSwitching(t *testing.T) {
	mgr := NewLocaleManager(LocaleEN)

	// Pre-warm runtime GC
	runtime.GC()
	var mBefore runtime.MemStats
	runtime.ReadMemStats(&mBefore)

	// Rapidly switch locales 50,000 times
	locales := []string{string(LocaleEN), string(LocaleBN), string(LocaleHI), string(LocaleBanglish)}
	for i := 0; i < 50000; i++ {
		loc := locales[i%len(locales)]
		_, _ = mgr.SetLocale(loc)
		_ = mgr.GetActiveLocale()
	}

	runtime.GC()
	var mAfter runtime.MemStats
	runtime.ReadMemStats(&mAfter)

	// Net heap growth should be tightly bounded (< 4MB) after GC
	heapDeltaMB := float64(int64(mAfter.HeapAlloc)-int64(mBefore.HeapAlloc)) / 1024 / 1024
	if heapDeltaMB > 4.0 {
		t.Fatalf("excessive heap growth (%.2f MB) indicates memory leak during rapid switching", heapDeltaMB)
	}
}
