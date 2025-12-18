package services

import (
	"net/http"
	"sync"
	"time"
)

// PERFORMANCE BOOST: HTTP client pool for better connection management
type HTTPClientPool struct {
	clients map[string]*http.Client
	mutex   sync.RWMutex
}

var (
	clientPool *HTTPClientPool
	once       sync.Once
)

// PERFORMANCE BOOST: Get singleton HTTP client pool
func GetHTTPClientPool() *HTTPClientPool {
	once.Do(func() {
		clientPool = &HTTPClientPool{
			clients: make(map[string]*http.Client),
		}
	})
	return clientPool
}

// PERFORMANCE BOOST: Get optimized HTTP client for specific service
func (p *HTTPClientPool) GetClient(service string) *http.Client {
	p.mutex.RLock()
	client, exists := p.clients[service]
	p.mutex.RUnlock()

	if exists {
		return client
	}

	// Create new optimized client
	p.mutex.Lock()
	defer p.mutex.Unlock()

	// Double-check after acquiring write lock
	if client, exists := p.clients[service]; exists {
		return client
	}

	// Create service-specific optimized transport
	transport := &http.Transport{
		MaxIdleConns:        100,
		MaxIdleConnsPerHost: 10,
		IdleConnTimeout:     90 * time.Second,
		DisableCompression:  false,
		ForceAttemptHTTP2:   true,
	}

	// Service-specific optimizations
	var timeout time.Duration
	switch service {
	case "groq":
		timeout = 45 * time.Second
		transport.MaxIdleConnsPerHost = 5 // Groq has rate limits
	case "supabase":
		timeout = 30 * time.Second
		transport.MaxIdleConnsPerHost = 15 // Database connections
	case "stripe":
		timeout = 30 * time.Second
		transport.MaxIdleConnsPerHost = 8 // Payment processing
	default:
		timeout = 30 * time.Second
	}

	client = &http.Client{
		Timeout:   timeout,
		Transport: transport,
	}

	p.clients[service] = client
	return client
}

// PERFORMANCE BOOST: Cleanup idle connections periodically
func (p *HTTPClientPool) CleanupIdleConnections() {
	p.mutex.RLock()
	clients := make([]*http.Client, 0, len(p.clients))
	for _, client := range p.clients {
		clients = append(clients, client)
	}
	p.mutex.RUnlock()

	for _, client := range clients {
		if transport, ok := client.Transport.(*http.Transport); ok {
			transport.CloseIdleConnections()
		}
	}
}

// PERFORMANCE BOOST: Start background cleanup routine
func StartConnectionCleanup() {
	go func() {
		ticker := time.NewTicker(5 * time.Minute)
		defer ticker.Stop()

		for range ticker.C {
			GetHTTPClientPool().CleanupIdleConnections()
		}
	}()
}