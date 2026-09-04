// Package backend provides movement, prompt processing, and cache management for the Eloquent platform.
package backend

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"sync"
	"time"
)

// ResetCacheResult contains statistics and status after resetting backend caches.
type ResetCacheResult struct {
	Success              bool   `json:"success"`
	FilesRemoved         int    `json:"filesRemoved"`
	BytesFreed           int64  `json:"bytesFreed"`
	EntriesEvicted       int    `json:"entriesEvicted"`
	BuffersReinitialized int    `json:"buffersReinitialized"`
	Timestamp            int64  `json:"timestamp"`
	Message              string `json:"message"`
	Error                string `json:"error,omitempty"`
}

// ResetCacheRequest represents an RPC/gRPC request to reset caches.
type ResetCacheRequest struct {
	ForceCleanTemp bool `json:"forceCleanTemp"`
	ReinitBuffers  bool `json:"reinitBuffers"`
}

// ResetCacheResponse represents an RPC/gRPC response for cache reset operations.
type ResetCacheResponse struct {
	Success bool              `json:"success"`
	Result  *ResetCacheResult `json:"result,omitempty"`
	Error   string            `json:"error,omitempty"`
}

// CacheManager manages in-memory audio buffers, session state maps, prompt caches,
// and temporary file stores for the Eloquent Go audio backend.
type CacheManager struct {
	mu           sync.RWMutex
	tempDir      string
	audioBuffers map[string][]byte
	promptCache  map[string]string
	sessionData  map[string]interface{}
	tempFiles    map[string]int64
	bufferPool   *sync.Pool
	defaultBufSz int
}

// DefaultBufferCapacity is the standard audio frame buffer chunk size (4096 bytes).
const DefaultBufferCapacity = 4096

// NewCacheManager initializes a new CacheManager with standard defaults.
func NewCacheManager(tempDir string) *CacheManager {
	if tempDir == "" {
		tempDir = filepath.Join(os.TempDir(), "eloquent_cache")
	}

	cm := &CacheManager{
		tempDir:      tempDir,
		audioBuffers: make(map[string][]byte),
		promptCache:  make(map[string]string),
		sessionData:  make(map[string]interface{}),
		tempFiles:    make(map[string]int64),
		defaultBufSz: DefaultBufferCapacity,
	}

	cm.initBufferPool()
	return cm
}

func (cm *CacheManager) initBufferPool() {
	bufSz := cm.defaultBufSz
	cm.bufferPool = &sync.Pool{
		New: func() interface{} {
			return make([]byte, bufSz)
		},
	}
}

// GetAudioBuffer retrieves an in-memory audio buffer by key.
func (cm *CacheManager) GetAudioBuffer(key string) ([]byte, bool) {
	cm.mu.RLock()
	defer cm.mu.RUnlock()
	buf, ok := cm.audioBuffers[key]
	if !ok {
		return nil, false
	}
	cpy := make([]byte, len(buf))
	copy(cpy, buf)
	return cpy, true
}

// SetAudioBuffer stores an in-memory audio buffer.
func (cm *CacheManager) SetAudioBuffer(key string, data []byte) {
	cm.mu.Lock()
	defer cm.mu.Unlock()
	cpy := make([]byte, len(data))
	copy(cpy, data)
	cm.audioBuffers[key] = cpy
}

// SetPromptCache stores a prompt in the prompt cache map.
func (cm *CacheManager) SetPromptCache(key, val string) {
	cm.mu.Lock()
	defer cm.mu.Unlock()
	cm.promptCache[key] = val
}

// GetPromptCache retrieves a prompt from the prompt cache map.
func (cm *CacheManager) GetPromptCache(key string) (string, bool) {
	cm.mu.RLock()
	defer cm.mu.RUnlock()
	v, ok := cm.promptCache[key]
	return v, ok
}

// SetSessionData stores arbitrary session data in memory.
func (cm *CacheManager) SetSessionData(key string, val interface{}) {
	cm.mu.Lock()
	defer cm.mu.Unlock()
	cm.sessionData[key] = val
}

// GetSessionData retrieves session data.
func (cm *CacheManager) GetSessionData(key string) (interface{}, bool) {
	cm.mu.RLock()
	defer cm.mu.RUnlock()
	v, ok := cm.sessionData[key]
	return v, ok
}

// CreateTempCacheFile creates a tracked temporary cache file in the temp directory.
func (cm *CacheManager) CreateTempCacheFile(name string, content []byte) (string, error) {
	cm.mu.Lock()
	defer cm.mu.Unlock()

	if err := os.MkdirAll(cm.tempDir, 0755); err != nil {
		return "", fmt.Errorf("failed to create temp directory %s: %w", cm.tempDir, err)
	}

	targetPath := filepath.Join(cm.tempDir, name)
	if err := os.WriteFile(targetPath, content, 0600); err != nil {
		return "", fmt.Errorf("failed to write temp file %s: %w", targetPath, err)
	}

	cm.tempFiles[targetPath] = int64(len(content))
	return targetPath, nil
}

// GetTempDir returns the active temporary directory path.
func (cm *CacheManager) GetTempDir() string {
	cm.mu.RLock()
	defer cm.mu.RUnlock()
	return cm.tempDir
}

// GetStats returns current in-memory item counts and tracked files.
func (cm *CacheManager) GetStats() (int, int, int, int) {
	cm.mu.RLock()
	defer cm.mu.RUnlock()
	return len(cm.audioBuffers), len(cm.promptCache), len(cm.sessionData), len(cm.tempFiles)
}

// ResetCache empties temporary files, clears in-memory maps, and reinitializes audio buffers.
func (cm *CacheManager) ResetCache() *ResetCacheResult {
	cm.mu.Lock()
	defer cm.mu.Unlock()

	now := time.Now().UnixMilli()
	result := &ResetCacheResult{
		Timestamp: now,
		Success:   true,
	}

	// 1. Evict in-memory maps
	evictedCount := len(cm.audioBuffers) + len(cm.promptCache) + len(cm.sessionData)
	var inMemBytesFreed int64
	for _, buf := range cm.audioBuffers {
		inMemBytesFreed += int64(len(buf))
	}
	for k, v := range cm.promptCache {
		inMemBytesFreed += int64(len(k) + len(v))
	}

	cm.audioBuffers = make(map[string][]byte)
	cm.promptCache = make(map[string]string)
	cm.sessionData = make(map[string]interface{})
	result.EntriesEvicted = evictedCount
	result.BytesFreed = inMemBytesFreed

	// 2. Reinitialize audio buffer pool
	cm.initBufferPool()
	result.BuffersReinitialized = 1

	// 3. Purge temporary files
	var filesRemoved int
	var fileBytesFreed int64
	var removalErrors []string

	// Clean tracked temp files
	for filePath, size := range cm.tempFiles {
		if err := os.Remove(filePath); err != nil && !os.IsNotExist(err) {
			removalErrors = append(removalErrors, fmt.Sprintf("%s: %v", filepath.Base(filePath), err))
		} else {
			filesRemoved++
			fileBytesFreed += size
		}
	}
	cm.tempFiles = make(map[string]int64)

	// Clean any remaining files in tempDir
	if cm.tempDir != "" {
		if entries, err := os.ReadDir(cm.tempDir); err == nil {
			for _, entry := range entries {
				if !entry.IsDir() {
					fullPath := filepath.Join(cm.tempDir, entry.Name())
					info, err := entry.Info()
					if err == nil {
						fileBytesFreed += info.Size()
					}
					if err := os.Remove(fullPath); err != nil && !os.IsNotExist(err) {
						removalErrors = append(removalErrors, fmt.Sprintf("%s: %v", entry.Name(), err))
					} else {
						filesRemoved++
					}
				}
			}
		}
	}

	result.FilesRemoved = filesRemoved
	result.BytesFreed += fileBytesFreed

	if len(removalErrors) > 0 {
		result.Error = fmt.Sprintf("some temp files could not be removed: %v", removalErrors)
		result.Message = fmt.Sprintf("Cache reset completed with %d warnings", len(removalErrors))
	} else {
		result.Message = fmt.Sprintf("Cache reset successfully: %d entries evicted, %d files removed (%d bytes freed)",
			result.EntriesEvicted, result.FilesRemoved, result.BytesFreed)
	}

	return result
}

// ResetCacheRPC processes an incoming RPC request to reset backend caches.
func (cm *CacheManager) ResetCacheRPC(req *ResetCacheRequest) (*ResetCacheResponse, error) {
	if req == nil {
		req = &ResetCacheRequest{ForceCleanTemp: true, ReinitBuffers: true}
	}

	result := cm.ResetCache()
	if result.Error != "" && !result.Success {
		return &ResetCacheResponse{
			Success: false,
			Result:  result,
			Error:   result.Error,
		}, nil
	}

	return &ResetCacheResponse{
		Success: true,
		Result:  result,
	}, nil
}

// HandleResetCacheHTTP handles HTTP POST /api/cache/reset requests from Electron/Node.js.
func (cm *CacheManager) HandleResetCacheHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost && r.Method != http.MethodDelete {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusMethodNotAllowed)
		_ = json.NewEncoder(w).Encode(map[string]string{
			"error": "Method not allowed. Use POST or DELETE.",
		})
		return
	}

	var req ResetCacheRequest
	if r.Body != nil {
		bodyBytes, _ := io.ReadAll(r.Body)
		if len(bodyBytes) > 0 {
			_ = json.Unmarshal(bodyBytes, &req)
		}
	}

	resp, err := cm.ResetCacheRPC(&req)
	w.Header().Set("Content-Type", "application/json")
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(resp)
}
