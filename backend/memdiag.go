package backend

import (
	"context"
	"fmt"
	"runtime"
	"strings"
	"sync"
	"time"
)

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

// MemDiagConfig holds configuration for the memory diagnostic monitor.
type MemDiagConfig struct {
	// Interval between consecutive ReadMemStats calls. Default: 2s.
	Interval time.Duration
	// HeapWarningMB is the threshold (in MB) above which a snapshot is flagged
	// as a warning. Default: 100.0.
	HeapWarningMB float64
	// LogPrefix is prepended to all log lines. Default: "[MemDiag]".
	LogPrefix string
	// OnWarning is an optional callback invoked whenever a warning snapshot is
	// produced. It is called from the background goroutine.
	OnWarning func(MemSnapshot)
}

// MemSnapshot is a point-in-time capture of heap and goroutine statistics.
type MemSnapshot struct {
	HeapInUseMB   float64 // runtime.MemStats.HeapInuse  / 1 MiB
	HeapAllocMB   float64 // runtime.MemStats.HeapAlloc  / 1 MiB
	HeapSysMB     float64 // runtime.MemStats.HeapSys    / 1 MiB
	GCCycles      uint32  // runtime.MemStats.NumGC
	NumGoroutines int     // runtime.NumGoroutine()
	HeapGrowthMB  float64 // HeapInUseMB delta from previous snapshot
	TimestampNs   int64   // time.Now().UnixNano() at capture time
	IsWarning     bool    // true when HeapInUseMB >= cfg.HeapWarningMB
}

const (
	ringCapacity = 60
	bytesPerMB   = 1 << 20 // 1 048 576
)

// ──────────────────────────────────────────────────────────────────────────────
// MemDiagMonitor
// ──────────────────────────────────────────────────────────────────────────────

// MemDiagMonitor samples Go runtime memory statistics on a fixed interval and
// maintains a ring-buffer of recent snapshots.
type MemDiagMonitor struct {
	mu           sync.Mutex
	history      []MemSnapshot // ring buffer, capacity ringCapacity
	lastSnapshot MemSnapshot   // most recent snapshot (cached)
	cfg          MemDiagConfig
	cancel       context.CancelFunc
	done         chan struct{}
}

// NewMemDiagMonitor creates a new MemDiagMonitor with the supplied config.
// Missing / zero config fields are replaced with sensible defaults.
func NewMemDiagMonitor(cfg MemDiagConfig) *MemDiagMonitor {
	if cfg.Interval <= 0 {
		cfg.Interval = 2 * time.Second
	}
	if cfg.HeapWarningMB <= 0 {
		cfg.HeapWarningMB = 100.0
	}
	if cfg.LogPrefix == "" {
		cfg.LogPrefix = "[MemDiag]"
	}
	return &MemDiagMonitor{
		history: make([]MemSnapshot, 0, ringCapacity),
		cfg:     cfg,
		done:    make(chan struct{}),
	}
}

// ──────────────────────────────────────────────────────────────────────────────
// Lifecycle
// ──────────────────────────────────────────────────────────────────────────────

// Start launches the background sampling goroutine. Calling Start more than
// once without an intervening Stop is a no-op.
func (m *MemDiagMonitor) Start(ctx context.Context) {
	child, cancel := context.WithCancel(ctx)
	m.cancel = cancel
	go m.loop(child)
}

// Stop cancels the background goroutine and blocks until it exits.
func (m *MemDiagMonitor) Stop() {
	if m.cancel != nil {
		m.cancel()
	}
	<-m.done
}

// loop is the background sampling goroutine body.
func (m *MemDiagMonitor) loop(ctx context.Context) {
	ticker := time.NewTicker(m.cfg.Interval)

	for {
		select {
		case <-ctx.Done():
			ticker.Stop()
			close(m.done)
			return

		case <-ticker.C:
			// ── collect stats (world-stop call kept here, not on hot path) ──
			var ms runtime.MemStats
			runtime.ReadMemStats(&ms)

			now := time.Now().UnixNano()
			heapInUseMB := float64(ms.HeapInuse) / bytesPerMB
			heapAllocMB := float64(ms.HeapAlloc) / bytesPerMB
			heapSysMB := float64(ms.HeapSys) / bytesPerMB

			m.mu.Lock()

			prevHeapInUseMB := m.lastSnapshot.HeapInUseMB
			growth := heapInUseMB - prevHeapInUseMB
			isWarn := heapInUseMB >= m.cfg.HeapWarningMB

			snap := MemSnapshot{
				HeapInUseMB:   heapInUseMB,
				HeapAllocMB:   heapAllocMB,
				HeapSysMB:     heapSysMB,
				GCCycles:      ms.NumGC,
				NumGoroutines: runtime.NumGoroutine(),
				HeapGrowthMB:  growth,
				TimestampNs:   now,
				IsWarning:     isWarn,
			}

			m.lastSnapshot = snap

			// ── ring-buffer append ────────────────────────────────────────────
			if len(m.history) < ringCapacity {
				m.history = append(m.history, snap)
			} else {
				// shift left by one to discard the oldest entry
				copy(m.history, m.history[1:])
				m.history[ringCapacity-1] = snap
			}

			m.mu.Unlock()

			// ── warning callback (outside the lock to prevent deadlocks) ──────
			if isWarn && m.cfg.OnWarning != nil {
				m.cfg.OnWarning(snap)
			}
		}
	}
}

// ──────────────────────────────────────────────────────────────────────────────
// Accessors
// ──────────────────────────────────────────────────────────────────────────────

// Snapshot returns the most recent snapshot from the cache.
// It does NOT call runtime.ReadMemStats so it is safe to call on the hot path.
func (m *MemDiagMonitor) Snapshot() MemSnapshot {
	m.mu.Lock()
	snap := m.lastSnapshot
	m.mu.Unlock()
	return snap
}

// History returns a copy of the ring-buffer containing up to 60 snapshots,
// ordered from oldest to most recent.
func (m *MemDiagMonitor) History() []MemSnapshot {
	m.mu.Lock()
	out := make([]MemSnapshot, len(m.history))
	copy(out, m.history)
	m.mu.Unlock()
	return out
}

// ──────────────────────────────────────────────────────────────────────────────
// Prometheus export
// ──────────────────────────────────────────────────────────────────────────────

// ExportPrometheusMetrics returns a Prometheus text-format string for the
// current cached snapshot.
func (m *MemDiagMonitor) ExportPrometheusMetrics() string {
	snap := m.Snapshot()

	var sb strings.Builder

	sb.WriteString("# HELP eloquent_go_heap_inuse_bytes Bytes of in-use heap spans\n")
	fmt.Fprintf(&sb, "eloquent_go_heap_inuse_bytes %g\n", snap.HeapInUseMB*bytesPerMB)

	sb.WriteString("# HELP eloquent_go_heap_alloc_bytes Bytes of allocated heap objects\n")
	fmt.Fprintf(&sb, "eloquent_go_heap_alloc_bytes %g\n", snap.HeapAllocMB*bytesPerMB)

	sb.WriteString("# HELP eloquent_go_heap_sys_bytes Bytes of heap memory obtained from the OS\n")
	fmt.Fprintf(&sb, "eloquent_go_heap_sys_bytes %g\n", snap.HeapSysMB*bytesPerMB)

	sb.WriteString("# HELP eloquent_go_gc_cycles_total Total number of completed GC cycles\n")
	fmt.Fprintf(&sb, "eloquent_go_gc_cycles_total %d\n", snap.GCCycles)

	sb.WriteString("# HELP eloquent_go_goroutines Current number of goroutines\n")
	fmt.Fprintf(&sb, "eloquent_go_goroutines %d\n", snap.NumGoroutines)

	sb.WriteString("# HELP eloquent_go_heap_growth_mb Heap growth in MB since the previous sample\n")
	fmt.Fprintf(&sb, "eloquent_go_heap_growth_mb %g\n", snap.HeapGrowthMB)

	return sb.String()
}

// ──────────────────────────────────────────────────────────────────────────────
// Package-level singleton
// ──────────────────────────────────────────────────────────────────────────────

// GlobalMemDiag is the package-level singleton. It is nil until InitGlobalMemDiag
// is called.
var GlobalMemDiag *MemDiagMonitor

// InitGlobalMemDiag creates a new MemDiagMonitor from cfg and assigns it to
// GlobalMemDiag. It does not automatically call Start; callers should do so
// when ready.
func InitGlobalMemDiag(cfg MemDiagConfig) {
	GlobalMemDiag = NewMemDiagMonitor(cfg)
}
