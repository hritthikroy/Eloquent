// Package scraper provides a high-throughput recursive web scraper and content parser for deep research.
package scraper

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"golang.org/x/net/html"
)

var (
	whitespaceRegex = regexp.MustCompile(`\s+`)
	tagScriptStyle  = map[string]bool{"script": true, "style": true, "noscript": true, "svg": true}
)

// ScrapeConfig specifies parameters, boundaries, and safety constraints for recursive crawling.
type ScrapeConfig struct {
	MaxDepth        int           `json:"maxDepth"`
	MaxPages        int           `json:"maxPages"`
	Concurrency     int           `json:"concurrency"`
	Timeout         time.Duration `json:"timeout"`
	RateLimitMs     int           `json:"rateLimitMs"`
	UserAgent       string        `json:"userAgent"`
	AllowedDomains  []string      `json:"allowedDomains,omitempty"`
	MaxContentBytes int64         `json:"maxContentBytes"`
}

// DefaultConfig returns safe, resilient default parameters.
func DefaultConfig() ScrapeConfig {
	return ScrapeConfig{
		MaxDepth:        2,
		MaxPages:        10,
		Concurrency:     4,
		Timeout:         5 * time.Second,
		RateLimitMs:     50,
		UserAgent:       "Eloquent-DeepResearch-Agent/2.1 (Google Antigravity; +https://eloquent.ai)",
		MaxContentBytes: 1024 * 1024, // 1MB
	}
}

// ScrapeResult represents the parsed content of an individual crawled page.
type ScrapeResult struct {
	URL        string    `json:"url"`
	Title      string    `json:"title"`
	Snippet    string    `json:"snippet"`
	Links      []string  `json:"links"`
	Depth      int       `json:"depth"`
	FetchedAt  time.Time `json:"fetchedAt"`
	ByteSize   int       `json:"byteSize"`
	StatusCode int       `json:"statusCode"`
	Error      string    `json:"error,omitempty"`
}

// DeepResearchReport aggregates recursive crawling outputs and key insights.
type DeepResearchReport struct {
	JobID        string         `json:"jobId"`
	Query        string         `json:"query"`
	RootURL      string         `json:"rootUrl"`
	PagesCrawled int            `json:"pagesCrawled"`
	TotalBytes   int64          `json:"totalBytes"`
	DurationMs   int64          `json:"durationMs"`
	Results      []ScrapeResult `json:"results"`
	KeyInsights  []string       `json:"keyInsights"`
}

type crawlTask struct {
	targetURL string
	depth     int
}

// RecursiveScraper coordinates concurrent web crawling with rate limiting and context safety.
type RecursiveScraper struct {
	config         ScrapeConfig
	client         *http.Client
	visited        map[string]bool
	visitedMu      sync.Mutex
	domainLastReq  map[string]time.Time
	domainMu       sync.Mutex
	totalBytesSeen int64
}

// NewRecursiveScraper instantiates a new RecursiveScraper.
func NewRecursiveScraper(cfg ScrapeConfig) *RecursiveScraper {
	if cfg.MaxDepth <= 0 {
		cfg.MaxDepth = 2
	}
	if cfg.MaxPages <= 0 {
		cfg.MaxPages = 10
	}
	if cfg.Concurrency <= 0 {
		cfg.Concurrency = 4
	}
	if cfg.Timeout <= 0 {
		cfg.Timeout = 5 * time.Second
	}
	if cfg.MaxContentBytes <= 0 {
		cfg.MaxContentBytes = 1024 * 1024
	}
	if cfg.UserAgent == "" {
		cfg.UserAgent = DefaultConfig().UserAgent
	}

	return &RecursiveScraper{
		config: cfg,
		client: &http.Client{
			Timeout: cfg.Timeout,
		},
		visited:       make(map[string]bool),
		domainLastReq: make(map[string]time.Time),
	}
}

// SetClient allows injecting a custom *http.Client (e.g., for testing with httptest.Server).
func (s *RecursiveScraper) SetClient(c *http.Client) {
	s.client = c
}

// Crawl executes autonomous recursive scraping starting from rootURL up to configured depth.
func (s *RecursiveScraper) Crawl(ctx context.Context, rootURL string, query string) (*DeepResearchReport, error) {
	tStart := time.Now()
	parsedRoot, err := url.Parse(rootURL)
	if err != nil || parsedRoot.Scheme == "" || parsedRoot.Host == "" {
		return nil, fmt.Errorf("invalid root URL '%s': %w", rootURL, err)
	}

	jobID := fmt.Sprintf("research_%d", tStart.UnixNano())
	report := &DeepResearchReport{
		JobID:       jobID,
		Query:       query,
		RootURL:     rootURL,
		Results:     make([]ScrapeResult, 0),
		KeyInsights: make([]string, 0),
	}

	s.visitedMu.Lock()
	s.visited = make(map[string]bool)
	s.visited[rootURL] = true
	s.visitedMu.Unlock()

	tasks := make(chan crawlTask, s.config.MaxPages*5)
	results := make(chan ScrapeResult, s.config.MaxPages)
	tasks <- crawlTask{targetURL: rootURL, depth: 0}

	var activeWorkers int32
	var completedCount int32
	var pendingTasks int32 = 1

	allDone := make(chan struct{})
	var closeOnce sync.Once
	signalDone := func() {
		closeOnce.Do(func() {
			close(allDone)
		})
	}

	var wg sync.WaitGroup
	workerCount := s.config.Concurrency

	for i := 0; i < workerCount; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for {
				select {
				case <-ctx.Done():
					return
				case task, ok := <-tasks:
					if !ok {
						return
					}

					atomic.AddInt32(&activeWorkers, 1)
					res := s.fetchAndParse(ctx, task.targetURL, task.depth)
					currentCompleted := atomic.AddInt32(&completedCount, 1)

					// Enqueue discovered links if depth allows and limit not reached
					if task.depth < s.config.MaxDepth && int(currentCompleted) < s.config.MaxPages {
						for _, link := range res.Links {
							s.visitedMu.Lock()
							if !s.visited[link] && len(s.visited) < s.config.MaxPages {
								s.visited[link] = true
								s.visitedMu.Unlock()
								atomic.AddInt32(&pendingTasks, 1)
								select {
								case tasks <- crawlTask{targetURL: link, depth: task.depth + 1}:
								case <-ctx.Done():
									atomic.AddInt32(&pendingTasks, -1)
									atomic.AddInt32(&activeWorkers, -1)
									return
								}
							} else {
								s.visitedMu.Unlock()
							}
						}
					}

					select {
					case results <- res:
					case <-ctx.Done():
						atomic.AddInt32(&pendingTasks, -1)
						atomic.AddInt32(&activeWorkers, -1)
						return
					}

					remaining := atomic.AddInt32(&pendingTasks, -1)
					atomic.AddInt32(&activeWorkers, -1)

					if remaining <= 0 || int(currentCompleted) >= s.config.MaxPages {
						signalDone()
					}
				}
			}
		}()
	}

	// Coordinator loop to collect results
	doneChan := make(chan struct{})
	go func() {
		defer close(doneChan)
		for {
			select {
			case <-ctx.Done():
				return
			case <-allDone:
				// Drain any remaining results in channel
				for len(results) > 0 {
					res := <-results
					report.Results = append(report.Results, res)
					if res.Title != "" {
						report.KeyInsights = append(report.KeyInsights, fmt.Sprintf("[%s]: %s", res.Title, res.Snippet))
					}
				}
				return
			case res := <-results:
				report.Results = append(report.Results, res)
				if res.Title != "" {
					report.KeyInsights = append(report.KeyInsights, fmt.Sprintf("[%s]: %s", res.Title, res.Snippet))
				}
				if len(report.Results) >= s.config.MaxPages {
					signalDone()
					return
				}
			}
		}
	}()

	<-doneChan
	close(tasks)
	wg.Wait()

	report.PagesCrawled = len(report.Results)
	report.TotalBytes = atomic.LoadInt64(&s.totalBytesSeen)
	report.DurationMs = time.Since(tStart).Milliseconds()

	return report, nil
}

func (s *RecursiveScraper) fetchAndParse(ctx context.Context, targetURL string, depth int) ScrapeResult {
	res := ScrapeResult{
		URL:       targetURL,
		Depth:     depth,
		FetchedAt: time.Now(),
		Links:     make([]string, 0),
	}

	parsed, err := url.Parse(targetURL)
	if err != nil {
		res.Error = "URL parse error: " + err.Error()
		return res
	}

	s.enforceRateLimit(parsed.Host)

	req, err := http.NewRequestWithContext(ctx, "GET", targetURL, nil)
	if err != nil {
		res.Error = "Request construction failed: " + err.Error()
		return res
	}
	req.Header.Set("User-Agent", s.config.UserAgent)
	req.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")

	resp, err := s.client.Do(req)
	if err != nil {
		res.Error = "Fetch error: " + err.Error()
		return res
	}
	defer resp.Body.Close()

	res.StatusCode = resp.StatusCode
	if resp.StatusCode >= 400 {
		res.Error = fmt.Sprintf("HTTP status error %d", resp.StatusCode)
		return res
	}

	// Limit read size to prevent memory bloat
	limitedReader := io.LimitReader(resp.Body, s.config.MaxContentBytes)
	bodyBytes, err := io.ReadAll(limitedReader)
	if err != nil {
		res.Error = "Body read error: " + err.Error()
		return res
	}

	res.ByteSize = len(bodyBytes)
	atomic.AddInt64(&s.totalBytesSeen, int64(len(bodyBytes)))

	title, snippet, links := s.extractHTML(string(bodyBytes), parsed)
	res.Title = title
	res.Snippet = snippet
	res.Links = links

	return res
}

func (s *RecursiveScraper) enforceRateLimit(domain string) {
	if s.config.RateLimitMs <= 0 {
		return
	}

	s.domainMu.Lock()
	defer s.domainMu.Unlock()

	lastReq, exists := s.domainLastReq[domain]
	now := time.Now()
	if exists {
		elapsed := now.Sub(lastReq)
		minDelay := time.Duration(s.config.RateLimitMs) * time.Millisecond
		if elapsed < minDelay {
			time.Sleep(minDelay - elapsed)
		}
	}
	s.domainLastReq[domain] = time.Now()
}

func (s *RecursiveScraper) extractHTML(htmlStr string, base *url.URL) (string, string, []string) {
	doc, err := html.Parse(strings.NewReader(htmlStr))
	if err != nil {
		return "", "", nil
	}

	var title string
	var textParts []string
	linksMap := make(map[string]bool)

	var walk func(*html.Node, bool)
	walk = func(n *html.Node, inScriptOrStyle bool) {
		if n.Type == html.ElementNode {
			if tagScriptStyle[strings.ToLower(n.Data)] {
				inScriptOrStyle = true
			}
			if strings.EqualFold(n.Data, "title") && n.FirstChild != nil {
				title = strings.TrimSpace(n.FirstChild.Data)
			}
			if strings.EqualFold(n.Data, "a") {
				for _, attr := range n.Attr {
					if strings.EqualFold(attr.Key, "href") {
						resolved := s.resolveURL(attr.Val, base)
						if resolved != "" {
							linksMap[resolved] = true
						}
					}
				}
			}
		}

		if n.Type == html.TextNode && !inScriptOrStyle {
			trimmed := strings.TrimSpace(n.Data)
			if len(trimmed) > 0 {
				textParts = append(textParts, trimmed)
			}
		}

		for c := n.FirstChild; c != nil; c = c.NextSibling {
			walk(c, inScriptOrStyle)
		}
	}

	walk(doc, false)

	combinedText := strings.Join(textParts, " ")
	combinedText = whitespaceRegex.ReplaceAllString(combinedText, " ")
	snippet := combinedText
	if len(snippet) > 300 {
		snippet = snippet[:300] + "..."
	}

	links := make([]string, 0, len(linksMap))
	for l := range linksMap {
		links = append(links, l)
	}

	return title, snippet, links
}

func (s *RecursiveScraper) resolveURL(href string, base *url.URL) string {
	href = strings.TrimSpace(href)
	if href == "" || strings.HasPrefix(href, "#") || strings.HasPrefix(href, "javascript:") || strings.HasPrefix(href, "mailto:") {
		return ""
	}

	parsed, err := url.Parse(href)
	if err != nil {
		return ""
	}

	resolved := base.ResolveReference(parsed)
	if resolved.Scheme != "http" && resolved.Scheme != "https" {
		return ""
	}

	// Remove fragment
	resolved.Fragment = ""

	// Check domain restriction if configured
	if len(s.config.AllowedDomains) > 0 {
		allowed := false
		for _, d := range s.config.AllowedDomains {
			if strings.EqualFold(resolved.Host, d) || strings.HasSuffix(strings.ToLower(resolved.Host), "."+strings.ToLower(d)) {
				allowed = true
				break
			}
		}
		if !allowed {
			return ""
		}
	}

	return resolved.String()
}
