package audio

import (
	"math/rand"
	"testing"
)

func BenchmarkJimmyBufferManager_ProcessIterative(b *testing.B) {
	cfg := DefaultJimmyConfig()
	mgr := NewJimmyBufferManager(cfg)
	payload := make([]byte, 1920*4) // 4 standard frames
	for i := range payload {
		payload[i] = byte(rand.Intn(256))
	}

	b.ResetTimer()
	b.ReportAllocs()
	for i := 0; i < b.N; i++ {
		_, err := mgr.ProcessIterative(payload, 1920)
		if err != nil {
			b.Fatal(err)
		}
	}
}

func BenchmarkJimmyBufferManager_ProcessWithTrampoline(b *testing.B) {
	cfg := DefaultJimmyConfig()
	mgr := NewJimmyBufferManager(cfg)
	payload := make([]byte, 1920*4)
	for i := range payload {
		payload[i] = byte(rand.Intn(256))
	}

	b.ResetTimer()
	b.ReportAllocs()
	for i := 0; i < b.N; i++ {
		err := mgr.ProcessWithTrampoline(payload, 1920, func(chunk []byte, index int) error {
			return nil
		})
		if err != nil {
			b.Fatal(err)
		}
	}
}

func BenchmarkJimmyBufferManager_AnalyzeChunk(b *testing.B) {
	cfg := DefaultJimmyConfig()
	mgr := NewJimmyBufferManager(cfg)
	chunk := make([]byte, 1920)
	for i := range chunk {
		chunk[i] = byte(i % 256)
	}

	b.ResetTimer()
	b.ReportAllocs()
	for i := 0; i < b.N; i++ {
		_ = mgr.analyzeChunk(chunk, 0)
	}
}
