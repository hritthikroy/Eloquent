// Package scraper provides the recursive scraper engine bridge.
package scraper

import (
	"context"
	scraperPkg "eloquent-backend/pkg/scraper"
)

// BridgeScraper wraps scraperPkg.RecursiveScraper.
type BridgeScraper struct {
	inner *scraperPkg.RecursiveScraper
}

// NewBridgeScraper creates a new BridgeScraper.
func NewBridgeScraper(cfg scraperPkg.ScrapeConfig) *BridgeScraper {
	return &BridgeScraper{
		inner: scraperPkg.NewRecursiveScraper(cfg),
	}
}

// Crawl proxies crawl execution.
func (b *BridgeScraper) Crawl(ctx context.Context, rootURL, query string) (*scraperPkg.DeepResearchReport, error) {
	return b.inner.Crawl(ctx, rootURL, query)
}
