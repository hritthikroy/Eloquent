package services

import (
	"sync"
	"time"
)

// PERFORMANCE BOOST: In-memory cache for frequently accessed data
type Cache struct {
	data  map[string]*CacheEntry
	mutex sync.RWMutex
}

type CacheEntry struct {
	Value     interface{}
	ExpiresAt time.Time
}

var (
	globalCache *Cache
	cacheOnce   sync.Once
)

// PERFORMANCE BOOST: Get singleton cache instance
func GetCache() *Cache {
	cacheOnce.Do(func() {
		globalCache = &Cache{
			data: make(map[string]*CacheEntry),
		}
		
		// Start cleanup routine
		go globalCache.startCleanup()
	})
	return globalCache
}

// PERFORMANCE BOOST: Set cache entry with TTL
func (c *Cache) Set(key string, value interface{}, ttl time.Duration) {
	c.mutex.Lock()
	defer c.mutex.Unlock()
	
	c.data[key] = &CacheEntry{
		Value:     value,
		ExpiresAt: time.Now().Add(ttl),
	}
}

// PERFORMANCE BOOST: Get cache entry
func (c *Cache) Get(key string) (interface{}, bool) {
	c.mutex.RLock()
	defer c.mutex.RUnlock()
	
	entry, exists := c.data[key]
	if !exists {
		return nil, false
	}
	
	if time.Now().After(entry.ExpiresAt) {
		// Entry expired, remove it
		go func() {
			c.mutex.Lock()
			delete(c.data, key)
			c.mutex.Unlock()
		}()
		return nil, false
	}
	
	return entry.Value, true
}

// PERFORMANCE BOOST: Delete cache entry
func (c *Cache) Delete(key string) {
	c.mutex.Lock()
	defer c.mutex.Unlock()
	delete(c.data, key)
}

// PERFORMANCE BOOST: Clear all cache entries
func (c *Cache) Clear() {
	c.mutex.Lock()
	defer c.mutex.Unlock()
	c.data = make(map[string]*CacheEntry)
}

// PERFORMANCE BOOST: Get cache statistics
func (c *Cache) Stats() map[string]interface{} {
	c.mutex.RLock()
	defer c.mutex.RUnlock()
	
	total := len(c.data)
	expired := 0
	now := time.Now()
	
	for _, entry := range c.data {
		if now.After(entry.ExpiresAt) {
			expired++
		}
	}
	
	return map[string]interface{}{
		"total":   total,
		"active":  total - expired,
		"expired": expired,
	}
}

// PERFORMANCE BOOST: Background cleanup of expired entries
func (c *Cache) startCleanup() {
	ticker := time.NewTicker(2 * time.Minute)
	defer ticker.Stop()
	
	for range ticker.C {
		c.cleanupExpired()
	}
}

func (c *Cache) cleanupExpired() {
	c.mutex.Lock()
	defer c.mutex.Unlock()
	
	now := time.Now()
	for key, entry := range c.data {
		if now.After(entry.ExpiresAt) {
			delete(c.data, key)
		}
	}
}

// PERFORMANCE BOOST: Cache helper functions for common use cases

// Cache user data
func CacheUser(userID string, user interface{}) {
	GetCache().Set("user:"+userID, user, 5*time.Minute)
}

func GetCachedUser(userID string) (interface{}, bool) {
	return GetCache().Get("user:" + userID)
}

// Cache API responses
func CacheAPIResponse(endpoint string, response interface{}) {
	GetCache().Set("api:"+endpoint, response, 1*time.Minute)
}

func GetCachedAPIResponse(endpoint string) (interface{}, bool) {
	return GetCache().Get("api:" + endpoint)
}

// Cache transcription results for duplicate requests
func CacheTranscription(audioHash string, result interface{}) {
	GetCache().Set("transcription:"+audioHash, result, 10*time.Minute)
}

func GetCachedTranscription(audioHash string) (interface{}, bool) {
	return GetCache().Get("transcription:" + audioHash)
}