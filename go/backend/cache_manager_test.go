package backend

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"sync"
	"testing"
)

func TestCacheManagerResetCache(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "eloquent_test_cache_*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	cm := NewCacheManager(tempDir)

	// Verify initial stats
	bCount, pCount, sCount, fCount := cm.GetStats()
	if bCount != 0 || pCount != 0 || sCount != 0 || fCount != 0 {
		t.Fatalf("expected empty stats, got %d %d %d %d", bCount, pCount, sCount, fCount)
	}

	// 1. Populate in-memory audio buffers
	cm.SetAudioBuffer("chunk-1", []byte{1, 2, 3, 4, 5})
	cm.SetAudioBuffer("chunk-2", []byte{6, 7, 8, 9, 10})

	data, ok := cm.GetAudioBuffer("chunk-1")
	if !ok || len(data) != 5 {
		t.Fatalf("expected chunk-1 present, got ok=%v, len=%d", ok, len(data))
	}

	// 2. Populate prompt cache and session data
	cm.SetPromptCache("prompt-1", "Hello world")
	prompt, ok := cm.GetPromptCache("prompt-1")
	if !ok || prompt != "Hello world" {
		t.Fatalf("expected prompt-1 present, got %s", prompt)
	}

	cm.SetSessionData("user-1", map[string]string{"name": "test"})
	session, ok := cm.GetSessionData("user-1")
	if !ok || session == nil {
		t.Fatalf("expected user-1 session data")
	}

	// 3. Create temp cache files
	file1, err := cm.CreateTempCacheFile("audio_sample_1.raw", []byte("audio payload 12345"))
	if err != nil {
		t.Fatalf("failed to create temp file 1: %v", err)
	}
	file2, err := cm.CreateTempCacheFile("audio_sample_2.raw", []byte("audio payload 67890"))
	if err != nil {
		t.Fatalf("failed to create temp file 2: %v", err)
	}

	// Also write an untracked file directly to tempDir to test directory sweep
	untrackedPath := filepath.Join(tempDir, "untracked.tmp")
	if err := os.WriteFile(untrackedPath, []byte("untracked file"), 0600); err != nil {
		t.Fatalf("failed to write untracked file: %v", err)
	}

	if _, err := os.Stat(file1); os.IsNotExist(err) {
		t.Fatalf("file1 does not exist")
	}
	if _, err := os.Stat(file2); os.IsNotExist(err) {
		t.Fatalf("file2 does not exist")
	}

	// 4. Perform ResetCache
	result := cm.ResetCache()
	if !result.Success {
		t.Fatalf("expected success true, got false with err: %s", result.Error)
	}
	if result.EntriesEvicted < 3 {
		t.Fatalf("expected at least 3 evicted entries, got %d", result.EntriesEvicted)
	}
	if result.FilesRemoved < 2 {
		t.Fatalf("expected at least 2 files removed, got %d", result.FilesRemoved)
	}
	if result.BytesFreed <= 0 {
		t.Fatalf("expected bytes freed > 0, got %d", result.BytesFreed)
	}
	if result.BuffersReinitialized != 1 {
		t.Fatalf("expected 1 buffer pool reinitialized, got %d", result.BuffersReinitialized)
	}

	// Verify post-reset in-memory state
	if _, found := cm.GetAudioBuffer("chunk-1"); found {
		t.Fatalf("expected chunk-1 to be evicted")
	}
	if _, found := cm.GetPromptCache("prompt-1"); found {
		t.Fatalf("expected prompt-1 to be evicted")
	}
	if _, found := cm.GetSessionData("user-1"); found {
		t.Fatalf("expected user-1 to be evicted")
	}

	// Verify files removed from filesystem
	if _, err := os.Stat(file1); !os.IsNotExist(err) {
		t.Fatalf("expected file1 to be removed from disk")
	}
	if _, err := os.Stat(file2); !os.IsNotExist(err) {
		t.Fatalf("expected file2 to be removed from disk")
	}
	if _, err := os.Stat(untrackedPath); !os.IsNotExist(err) {
		t.Fatalf("expected untracked.tmp to be removed from disk")
	}

	bCount, pCount, sCount, fCount = cm.GetStats()
	if bCount != 0 || pCount != 0 || sCount != 0 || fCount != 0 {
		t.Fatalf("expected 0 stats post reset, got %d %d %d %d", bCount, pCount, sCount, fCount)
	}
}

func TestCacheManagerRPCAndHTTP(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "eloquent_rpc_test_*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	cm := NewCacheManager(tempDir)
	cm.SetAudioBuffer("key1", []byte{1, 2, 3})

	// Test ResetCacheRPC with nil request
	resp, err := cm.ResetCacheRPC(nil)
	if err != nil || !resp.Success || resp.Result == nil {
		t.Fatalf("expected successful RPC response, got resp=%+v, err=%v", resp, err)
	}

	// Test HTTP POST handler
	cm.SetAudioBuffer("key2", []byte{4, 5, 6})
	reqBody, _ := json.Marshal(ResetCacheRequest{ForceCleanTemp: true, ReinitBuffers: true})
	httpReq := httptest.NewRequest(http.MethodPost, "/api/cache/reset", bytes.NewReader(reqBody))
	rr := httptest.NewRecorder()

	cm.HandleResetCacheHTTP(rr, httpReq)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d: %s", rr.Code, rr.Body.String())
	}

	var httpResp ResetCacheResponse
	if err := json.NewDecoder(rr.Body).Decode(&httpResp); err != nil {
		t.Fatalf("failed to decode json response: %v", err)
	}
	if !httpResp.Success || httpResp.Result == nil {
		t.Fatalf("expected success true in HTTP response")
	}

	// Test HTTP Method Not Allowed
	invalidReq := httptest.NewRequest(http.MethodGet, "/api/cache/reset", nil)
	rrInvalid := httptest.NewRecorder()
	cm.HandleResetCacheHTTP(rrInvalid, invalidReq)
	if rrInvalid.Code != http.StatusMethodNotAllowed {
		t.Fatalf("expected 405 Method Not Allowed, got %d", rrInvalid.Code)
	}
}

func TestCacheManagerConcurrencyAndMissingKeys(t *testing.T) {
	cm := NewCacheManager("")
	if cm.GetTempDir() == "" {
		t.Fatalf("expected non-empty default temp dir")
	}

	// Missing keys
	if _, ok := cm.GetAudioBuffer("missing"); ok {
		t.Fatalf("expected missing audio buffer to return false")
	}
	if _, ok := cm.GetPromptCache("missing"); ok {
		t.Fatalf("expected missing prompt to return false")
	}
	if _, ok := cm.GetSessionData("missing"); ok {
		t.Fatalf("expected missing session to return false")
	}

	// Concurrent operations
	var wg sync.WaitGroup
	for i := 0; i < 50; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			cm.SetAudioBuffer("chunk", []byte{byte(idx)})
			cm.SetPromptCache("p", "v")
			cm.SetSessionData("s", idx)
			_, _ = cm.GetAudioBuffer("chunk")
			_, _ = cm.GetPromptCache("p")
			_, _ = cm.GetSessionData("s")
		}(i)
	}
	wg.Wait()

	// Concurrent reset while reading/writing
	for i := 0; i < 10; i++ {
		wg.Add(2)
		go func() {
			defer wg.Done()
			_ = cm.ResetCache()
		}()
		go func() {
			defer wg.Done()
			cm.SetAudioBuffer("c", []byte{1, 2})
			_ = cm.ResetCache()
		}()
	}
	wg.Wait()

	// Buffer pool usage test
	poolBuf := cm.bufferPool.Get().([]byte)
	if len(poolBuf) != DefaultBufferCapacity {
		t.Fatalf("expected buffer pool buffer length %d, got %d", DefaultBufferCapacity, len(poolBuf))
	}
	cm.bufferPool.Put(poolBuf)
}

func TestCacheManagerEdgeCasesAndHTTPDelete(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "eloquent_edge_test_*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	cm := NewCacheManager(tempDir)

	// Test HTTP DELETE method
	httpReq := httptest.NewRequest(http.MethodDelete, "/api/cache/reset", nil)
	rr := httptest.NewRecorder()
	cm.HandleResetCacheHTTP(rr, httpReq)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200 OK on DELETE, got %d", rr.Code)
	}

	// Test invalid tempDir creation error on CreateTempCacheFile
	// Create a regular file where the directory should be
	invalidTempDir := filepath.Join(tempDir, "file_as_dir")
	_ = os.WriteFile(invalidTempDir, []byte("blocker"), 0600)
	cmInvalid := NewCacheManager(invalidTempDir)
	_, err = cmInvalid.CreateTempCacheFile("test.tmp", []byte("data"))
	if err == nil {
		t.Fatalf("expected error when tempDir is invalid file")
	}

	// Test ResetCacheRPC with explicit request options
	req := &ResetCacheRequest{ForceCleanTemp: true, ReinitBuffers: true}
	resp, err := cm.ResetCacheRPC(req)
	if err != nil || !resp.Success {
		t.Fatalf("expected success with explicit request, got resp=%+v, err=%v", resp, err)
	}
}
