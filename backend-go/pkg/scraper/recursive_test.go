package scraper

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

type memoryTransport struct {
	handler http.Handler
}

func (m *memoryTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	rec := httptest.NewRecorder()
	m.handler.ServeHTTP(rec, req)
	return rec.Result(), nil
}

func TestRecursiveScraper_Crawl(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/html")
		switch r.URL.Path {
		case "/":
			fmt.Fprintln(w, `
				<html>
				<head><title>Root Knowledge Base</title></head>
				<body>
					<h1>Antigravity Autonomous Core</h1>
					<p>Deep research entry point for multi-agent reasoning.</p>
					<a href="/architecture">Architecture Overview</a>
					<a href="/agents">Agent Squad</a>
				</body>
				</html>
			`)
		case "/architecture":
			fmt.Fprintln(w, `
				<html>
				<head><title>Architecture Overview</title></head>
				<body>
					<p>Zero-copy shared memory IPC bridge between Electron and Go audio backend.</p>
					<a href="/details">Deep Details</a>
				</body>
				</html>
			`)
		case "/agents":
			fmt.Fprintln(w, `
				<html>
				<head><title>Agent Squad</title></head>
				<body>
					<p>Andrew, Jenny, Tuk Tuk, and Brian collaborating continuously.</p>
				</body>
				</html>
			`)
		case "/details":
			fmt.Fprintln(w, `
				<html>
				<head><title>Technical Details</title></head>
				<body>
					<p>Lock-free ring buffers with sub-0.05ms frame serialization latency.</p>
				</body>
				</html>
			`)
		default:
			http.NotFound(w, r)
		}
	})

	cfg := ScrapeConfig{
		MaxDepth:    2,
		MaxPages:    5,
		Concurrency: 2,
		Timeout:     2 * time.Second,
		RateLimitMs: 0,
		UserAgent:   "Eloquent-Test-Crawler",
	}

	scraper := NewRecursiveScraper(cfg)
	scraper.SetClient(&http.Client{
		Transport: &memoryTransport{handler: mux},
	})

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	report, err := scraper.Crawl(ctx, "http://eloquent.local/", "Antigravity IPC architecture")
	if err != nil {
		t.Fatalf("Crawl returned unexpected error: %v", err)
	}

	if report.PagesCrawled < 3 {
		t.Fatalf("Expected at least 3 pages crawled, got %d", report.PagesCrawled)
	}

	if len(report.KeyInsights) < 2 {
		t.Fatalf("Expected at least 2 key insights, got %d", len(report.KeyInsights))
	}

	// Verify title extraction
	foundRoot := false
	for _, res := range report.Results {
		if strings.Contains(res.Title, "Root Knowledge Base") {
			foundRoot = true
			if !strings.Contains(res.Snippet, "Deep research entry point") {
				t.Fatalf("Expected snippet content, got: %s", res.Snippet)
			}
		}
	}
	if !foundRoot {
		t.Fatal("Expected to find Root Knowledge Base in crawl results")
	}
}

func TestRecursiveScraper_DepthBoundary(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/html")
		switch r.URL.Path {
		case "/":
			fmt.Fprintln(w, `<html><head><title>D0</title></head><body><a href="/d1">D1</a></body></html>`)
		case "/d1":
			fmt.Fprintln(w, `<html><head><title>D1</title></head><body><a href="/d2">D2</a></body></html>`)
		case "/d2":
			fmt.Fprintln(w, `<html><head><title>D2</title></head><body><a href="/d3">D3</a></body></html>`)
		case "/d3":
			fmt.Fprintln(w, `<html><head><title>D3</title></head><body>Deepest</body></html>`)
		}
	})

	// MaxDepth: 1 allows depth 0 (/) and depth 1 (/d1), but not depth 2 (/d2)
	cfg := ScrapeConfig{
		MaxDepth:    1,
		MaxPages:    10,
		Concurrency: 2,
		Timeout:     2 * time.Second,
		RateLimitMs: 0,
	}

	scraper := NewRecursiveScraper(cfg)
	scraper.SetClient(&http.Client{
		Transport: &memoryTransport{handler: mux},
	})

	ctx := context.Background()
	report, err := scraper.Crawl(ctx, "http://eloquent.local/", "depth test")
	if err != nil {
		t.Fatalf("Crawl error: %v", err)
	}

	for _, res := range report.Results {
		if res.Depth > 1 {
			t.Fatalf("Page crawled beyond max depth: URL=%s, depth=%d", res.URL, res.Depth)
		}
	}
}

func TestRecursiveScraper_TimeoutAndCancellation(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(100 * time.Millisecond)
		fmt.Fprintln(w, `<html><head><title>Slow</title></head><body>Slow response</body></html>`)
	})

	cfg := ScrapeConfig{
		MaxDepth:    2,
		MaxPages:    5,
		Concurrency: 2,
		Timeout:     2 * time.Second,
	}

	scraper := NewRecursiveScraper(cfg)
	scraper.SetClient(&http.Client{
		Transport: &memoryTransport{handler: mux},
	})

	// Cancel context after 20ms
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Millisecond)
	defer cancel()

	report, err := scraper.Crawl(ctx, "http://eloquent.local/", "timeout test")
	if err != nil {
		t.Fatalf("Unexpected error from Crawl with cancelled context: %v", err)
	}

	if report == nil {
		t.Fatal("Expected non-nil report even after cancellation")
	}
}

func TestRecursiveScraper_ConcurrentRace(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/html")
		fmt.Fprintf(w, `
			<html>
			<head><title>Page %s</title></head>
			<body>
				<p>Concurrent test page %s</p>
				<a href="/sub1">Sub 1</a>
				<a href="/sub2">Sub 2</a>
				<a href="/sub3">Sub 3</a>
			</body>
			</html>
		`, r.URL.Path, r.URL.Path)
	})

	cfg := ScrapeConfig{
		MaxDepth:    2,
		MaxPages:    8,
		Concurrency: 6,
		Timeout:     2 * time.Second,
		RateLimitMs: 0,
	}

	scraper := NewRecursiveScraper(cfg)
	scraper.SetClient(&http.Client{
		Transport: &memoryTransport{handler: mux},
	})

	ctx := context.Background()
	report, err := scraper.Crawl(ctx, "http://eloquent.local/", "race test")
	if err != nil {
		t.Fatalf("Crawl failed: %v", err)
	}

	if report.PagesCrawled == 0 {
		t.Fatal("Expected at least one page crawled in race test")
	}
}
