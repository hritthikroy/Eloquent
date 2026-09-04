// Package audio provides thread-safe, dynamic locale switching and audio pipeline
// synchronization for multi-language speech recognition (STT) and neural synthesis (TTS).
package audio

import (
	"errors"
	"fmt"
	"sync"
	"sync/atomic"
	"time"
)

// Locale identifies a supported language or dialect locale.
type Locale string

const (
	LocaleEN       Locale = "en-US"
	LocaleBN       Locale = "bn-IN"
	LocaleBanglish Locale = "bn-Roman"
	LocaleHI       Locale = "hi-IN"
	LocaleHinglish Locale = "hi-Roman"

	DefaultLocale = LocaleEN
)

var (
	// ErrUnsupportedLocale indicates an unknown locale was requested.
	ErrUnsupportedLocale = errors.New("requested locale is not supported")
	// ErrNilConfig indicates an empty configuration was supplied.
	ErrNilConfig = errors.New("locale configuration cannot be nil")
)

// STTProfile defines acoustic and speech recognition model parameters.
type STTProfile struct {
	ModelName      string  `json:"modelName"`
	LanguageCode   string  `json:"languageCode"`
	AcousticModel  string  `json:"acousticModel"`
	VADSilenceMs   int     `json:"vadSilenceMs"`
	VADThreshold   float64 `json:"vadThreshold"`
	EnableJitterBuf bool   `json:"enableJitterBuf"`
}

// TTSProfile defines voice synthesis parameters for the locale.
type TTSProfile struct {
	VoiceName                string `json:"voiceName"`
	VoiceModel               string `json:"voiceModel"`
	PitchOffset              string `json:"pitchOffset"`
	RateOffset               string `json:"rateOffset"`
	RequiresTransliteration  bool   `json:"requiresTransliteration"`
}

// LocaleConfig encapsulates audio engine configurations for a specific locale.
type LocaleConfig struct {
	Locale     Locale     `json:"locale"`
	SampleRate int        `json:"sampleRate"`
	Channels   int        `json:"channels"`
	STT        STTProfile `json:"stt"`
	TTS        TTSProfile `json:"tts"`
}

// LocaleTelemetry tracks operational metrics and race-safety statistics.
type LocaleTelemetry struct {
	SwitchesTotal       atomic.Uint64
	FailedSwitches      atomic.Uint64
	ConcurrentUpdates   atomic.Int64
	LastSwitchLatencyNs atomic.Int64
	ActiveLocaleName    atomic.Pointer[string]
}

// LocaleTelemetrySnapshot provides a point-in-time snapshot of telemetry metrics.
type LocaleTelemetrySnapshot struct {
	SwitchesTotal       uint64 `json:"switchesTotal"`
	FailedSwitches      uint64 `json:"failedSwitches"`
	ActiveLocale        string `json:"activeLocale"`
	LastSwitchLatencyUs int64  `json:"lastSwitchLatencyUs"`
}

// LocaleManager coordinates dynamic locale parameter switching across STT & TTS pipelines.
type LocaleManager struct {
	mu           sync.RWMutex
	activeConfig atomic.Pointer[LocaleConfig]
	profiles     map[Locale]LocaleConfig
	telemetry    *LocaleTelemetry
	listeners    []func(prev, next LocaleConfig)
}

// NewLocaleManager initializes a thread-safe LocaleManager with default locale profiles.
func NewLocaleManager(initialLocale Locale) *LocaleManager {
	mgr := &LocaleManager{
		profiles:  make(map[Locale]LocaleConfig),
		telemetry: &LocaleTelemetry{},
		listeners: make([]func(prev, next LocaleConfig), 0),
	}

	mgr.initDefaultProfiles()

	activeLoc := initialLocale
	if _, exists := mgr.profiles[activeLoc]; !exists {
		activeLoc = DefaultLocale
	}

	cfg := mgr.profiles[activeLoc]
	mgr.activeConfig.Store(&cfg)
	locStr := string(activeLoc)
	mgr.telemetry.ActiveLocaleName.Store(&locStr)

	return mgr
}

// initDefaultProfiles populates standard acoustic and voice configurations.
func (m *LocaleManager) initDefaultProfiles() {
	m.profiles[LocaleEN] = LocaleConfig{
		Locale:     LocaleEN,
		SampleRate: 48000,
		Channels:   1,
		STT: STTProfile{
			ModelName:       "whisper-large-v3-turbo",
			LanguageCode:    "en",
			AcousticModel:   "english-neural-v2",
			VADSilenceMs:    450,
			VADThreshold:    0.003,
			EnableJitterBuf: false,
		},
		TTS: TTSProfile{
			VoiceName:               "en-US-AvaMultilingualNeural",
			VoiceModel:              "neural-high-fi",
			PitchOffset:             "+0Hz",
			RateOffset:              "+0%",
			RequiresTransliteration: false,
		},
	}

	m.profiles[LocaleBN] = LocaleConfig{
		Locale:     LocaleBN,
		SampleRate: 48000,
		Channels:   1,
		STT: STTProfile{
			ModelName:       "whisper-large-v3-indic",
			LanguageCode:    "bn",
			AcousticModel:   "indic-bengali-v1",
			VADSilenceMs:    600,
			VADThreshold:    0.0028,
			EnableJitterBuf: true,
		},
		TTS: TTSProfile{
			VoiceName:               "en-US-AvaMultilingualNeural",
			VoiceModel:              "neural-multilingual",
			PitchOffset:             "+0Hz",
			RateOffset:              "+0%",
			RequiresTransliteration: false,
		},
	}

	m.profiles[LocaleBanglish] = LocaleConfig{
		Locale:     LocaleBanglish,
		SampleRate: 48000,
		Channels:   1,
		STT: STTProfile{
			ModelName:       "whisper-large-v3-indic",
			LanguageCode:    "en",
			AcousticModel:   "banglish-phonetic-v1",
			VADSilenceMs:    550,
			VADThreshold:    0.003,
			EnableJitterBuf: true,
		},
		TTS: TTSProfile{
			VoiceName:               "en-US-AndrewNeural",
			VoiceModel:              "neural-crisp",
			PitchOffset:             "+0Hz",
			RateOffset:              "+0%",
			RequiresTransliteration: true,
		},
	}

	m.profiles[LocaleHI] = LocaleConfig{
		Locale:     LocaleHI,
		SampleRate: 48000,
		Channels:   1,
		STT: STTProfile{
			ModelName:       "whisper-large-v3-indic",
			LanguageCode:    "hi",
			AcousticModel:   "indic-hindi-v1",
			VADSilenceMs:    550,
			VADThreshold:    0.0028,
			EnableJitterBuf: true,
		},
		TTS: TTSProfile{
			VoiceName:               "en-US-AvaMultilingualNeural",
			VoiceModel:              "neural-multilingual",
			PitchOffset:             "+0Hz",
			RateOffset:              "+0%",
			RequiresTransliteration: false,
		},
	}

	m.profiles[LocaleHinglish] = LocaleConfig{
		Locale:     LocaleHinglish,
		SampleRate: 48000,
		Channels:   1,
		STT: STTProfile{
			ModelName:       "whisper-large-v3-turbo",
			LanguageCode:    "en",
			AcousticModel:   "hinglish-colloquial-v1",
			VADSilenceMs:    500,
			VADThreshold:    0.003,
			EnableJitterBuf: true,
		},
		TTS: TTSProfile{
			VoiceName:               "en-US-AvaMultilingualNeural",
			VoiceModel:              "neural-multilingual",
			PitchOffset:             "+0Hz",
			RateOffset:              "+0%",
			RequiresTransliteration: false,
		},
	}
}

// GetActiveLocale returns the current active LocaleConfig lock-free.
// Safe for high-frequency call inside audio processing hot paths.
func (m *LocaleManager) GetActiveLocale() LocaleConfig {
	ptr := m.activeConfig.Load()
	if ptr == nil {
		return m.profiles[DefaultLocale]
	}
	return *ptr
}

// SetLocale dynamically switches the audio pipeline locale with thread safety.
// If an unsupported locale is requested, it falls back to en-US gracefully.
func (m *LocaleManager) SetLocale(locStr string) (LocaleConfig, error) {
	t0 := time.Now()
	m.telemetry.ConcurrentUpdates.Add(1)
	defer m.telemetry.ConcurrentUpdates.Add(-1)

	target := Locale(locStr)

	m.mu.Lock()
	targetConfig, exists := m.profiles[target]
	var switchErr error

	if !exists {
		// Graceful degradation fallback to DefaultLocale
		targetConfig = m.profiles[DefaultLocale]
		switchErr = fmt.Errorf("%w: %s (fallback applied: %s)", ErrUnsupportedLocale, locStr, DefaultLocale)
		m.telemetry.FailedSwitches.Add(1)
	}

	prevConfig := *m.activeConfig.Load()
	m.activeConfig.Store(&targetConfig)

	str := string(targetConfig.Locale)
	m.telemetry.ActiveLocaleName.Store(&str)
	m.telemetry.SwitchesTotal.Add(1)

	elapsedNs := time.Since(t0).Nanoseconds()
	m.telemetry.LastSwitchLatencyNs.Store(elapsedNs)

	listenersCopy := make([]func(prev, next LocaleConfig), len(m.listeners))
	copy(listenersCopy, m.listeners)
	m.mu.Unlock()

	// Notify listeners outside mutex lock to prevent lock contention
	for _, listener := range listenersCopy {
		if listener != nil {
			listener(prevConfig, targetConfig)
		}
	}

	return targetConfig, switchErr
}

// RegisterProfile adds or overrides a locale configuration profile.
func (m *LocaleManager) RegisterProfile(loc Locale, cfg LocaleConfig) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.profiles[loc] = cfg
}

// AddListener registers a notification callback for locale changes.
func (m *LocaleManager) AddListener(listener func(prev, next LocaleConfig)) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.listeners = append(m.listeners, listener)
}

// GetSupportedLocales returns a slice of all registered locales.
func (m *LocaleManager) GetSupportedLocales() []Locale {
	m.mu.RLock()
	defer m.mu.RUnlock()

	locales := make([]Locale, 0, len(m.profiles))
	for loc := range m.profiles {
		locales = append(locales, loc)
	}
	return locales
}

// GetTelemetrySnapshot returns a point-in-time snapshot of telemetry metrics.
func (m *LocaleManager) GetTelemetrySnapshot() LocaleTelemetrySnapshot {
	activeName := ""
	if ptr := m.telemetry.ActiveLocaleName.Load(); ptr != nil {
		activeName = *ptr
	}

	return LocaleTelemetrySnapshot{
		SwitchesTotal:       m.telemetry.SwitchesTotal.Load(),
		FailedSwitches:      m.telemetry.FailedSwitches.Load(),
		ActiveLocale:        activeName,
		LastSwitchLatencyUs: m.telemetry.LastSwitchLatencyNs.Load() / 1000,
	}
}
