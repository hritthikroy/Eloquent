/**
 * Browser Agent & Web Content Extractor for Eloquent
 *
 * Capabilities:
 * 1. Web Search — Multi-engine chain:
 *    DuckDuckGo Instant Answer API (free, no key)
 *    → Brave Search API (free tier, set ELOQUENT_BRAVE_API_KEY in .env)
 *    → Google Custom Search JSON API (100/day free, set ELOQUENT_GOOGLE_API_KEY + ELOQUENT_GOOGLE_CX)
 *    → Offline browser-launch fallback (always succeeds, zero failure)
 * 2. Web URL Content Fetcher & Markdown Extractor (readUrlContent)
 * 3. Native Browser Control (openInBrowser)
 * 4. Structured Web Summarization & Fast Caching
 * 5. Injectable HTTP Adapter (options.httpAdapter) — swap in a mock for tests,
 *    use real Node.js https/http in the live Electron app (FULL LIVE NETWORK)
 *
 * ── Optional .env keys (add to EloquentElectron/.env) ─────────────────────
 *   ELOQUENT_BRAVE_API_KEY   = bsa_...  (get free at brave.com/search/api)
 *   ELOQUENT_GOOGLE_API_KEY  = AIza...  (Google Cloud Console)
 *   ELOQUENT_GOOGLE_CX       = 0123...  (Programmable Search Engine CX)
 */

const https = require('https');
const http  = require('http');
const { URL } = require('url');
const { exec } = require('child_process');

// Load .env from project root (silent if dotenv not installed)
try { require('dotenv').config(); } catch (_) {}

const BRAVE_API_KEY  = process.env.ELOQUENT_BRAVE_API_KEY  || null;
const GOOGLE_API_KEY = process.env.ELOQUENT_GOOGLE_API_KEY || null;
const GOOGLE_CX      = process.env.ELOQUENT_GOOGLE_CX      || null;

class BrowserAgent {
  /**
   * @param {object}  [options]
   * @param {object}  [options.httpAdapter]  Injectable adapter for offline testing.
   *   Shape: { get(url, opts, cb) } — same as Node.js http/https.get.
   *   When null (default) the real https/http modules are used (live network).
   * @param {string}  [options.userAgent]    Override User-Agent string.
   */
  constructor(options = {}) {
    this.userAgent = options.userAgent ||
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    this.cache    = new Map();
    this._adapter = options.httpAdapter || null;
  }

  _getProtocol(parsedUrl) {
    if (this._adapter) return this._adapter;
    return parsedUrl.protocol === 'https:' ? https : http;
  }

  // Low-level GET — used by all engines
  _httpGet(targetUrl, extraHeaders = {}) {
    return new Promise((resolve) => {
      try {
        const parsedUrl = new URL(targetUrl);
        const protocol  = this._getProtocol(parsedUrl);
        let rawData     = '';
        const maxBytes  = 200000;

        const req = protocol.get(targetUrl, {
          headers: {
            'User-Agent': this.userAgent,
            'Accept':     'application/json,text/html,*/*;q=0.8',
            ...extraHeaders
          },
          timeout: 10000
        }, (res) => {
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            return resolve(this._httpGet(res.headers.location, extraHeaders));
          }
          if (res.statusCode < 200 || res.statusCode >= 300) {
            return resolve({ success: false, statusCode: res.statusCode, url: targetUrl, error: `HTTP ${res.statusCode}` });
          }
          res.setEncoding('utf8');
          res.on('data', (chunk) => {
            rawData += chunk;
            if (rawData.length > maxBytes) req.destroy();
          });
          res.on('end', () => resolve({ success: true, statusCode: 200, url: targetUrl, raw: rawData }));
        });

        req.on('error',   (err) => resolve({ success: false, url: targetUrl, error: err.message }));
        req.on('timeout', ()    => { req.destroy(); resolve({ success: false, url: targetUrl, error: 'Timeout 10s' }); });
      } catch (err) {
        resolve({ success: false, url: targetUrl, error: err.message });
      }
    });
  }

  // ─── 1. readUrlContent ────────────────────────────────────────────────────
  async readUrlContent(targetUrl) {
    if (!targetUrl || typeof targetUrl !== 'string') throw new Error('Invalid URL');
    if (this.cache.has(targetUrl)) return this.cache.get(targetUrl);

    const res = await this._httpGet(targetUrl);
    if (!res.success) return { success: false, url: targetUrl, error: res.error };

    const cleanText = this._cleanHtml(res.raw);
    const title     = this._extractTitle(res.raw);
    const result    = {
      success: true, statusCode: 200, url: targetUrl,
      title: title || targetUrl,
      content: cleanText.slice(0, 10000),
      length:  cleanText.length
    };
    this.cache.set(targetUrl, result);
    return result;
  }

  // ─── 2. searchWeb — multi-engine chain ───────────────────────────────────
  async searchWeb(query) {
    if (!query || typeof query !== 'string' || !query.trim()) {
      return { success: false, query: '', results: [] };
    }
    const q    = query.trim();
    const safe = encodeURIComponent(q);

    // Engine 1 — DuckDuckGo (always first, no key)
    const ddg = await this._ddgSearch(q, safe);
    if (ddg && ddg.results.length > 0) {
      return { ...ddg, engine: 'DuckDuckGo', isLive: true };
    }

    // Engine 2 — Brave Search (needs ELOQUENT_BRAVE_API_KEY)
    if (BRAVE_API_KEY) {
      const brave = await this._braveSearch(q, safe);
      if (brave && brave.results.length > 0) {
        return { ...brave, engine: 'Brave', isLive: true };
      }
    }

    // Engine 3 — Google Custom Search (needs ELOQUENT_GOOGLE_API_KEY + CX)
    if (GOOGLE_API_KEY && GOOGLE_CX) {
      const google = await this._googleSearch(q, safe);
      if (google && google.results.length > 0) {
        return { ...google, engine: 'Google', isLive: true };
      }
    }

    // Engine 4 — Offline fallback (sandbox / no network — always returns success)
    return {
      success: true, isLive: false, isOfflineFallback: true,
      engine: 'Offline', query: q, count: 1,
      results: [{
        title:   `Search for "${q}"`,
        snippet: `Open in browser: https://duckduckgo.com/?q=${safe}`,
        url:     `https://duckduckgo.com/?q=${safe}`
      }]
    };
  }

  async _ddgSearch(q, safe) {
    const res = await this._httpGet(
      `https://api.duckduckgo.com/?q=${safe}&format=json&no_html=1&skip_disambig=1`
    );
    if (!res.success) return null;
    try {
      const data    = JSON.parse(res.raw);
      const results = [];
      if (data.AbstractText) {
        results.push({ title: data.Heading || q, snippet: data.AbstractText, url: data.AbstractURL || '' });
      }
      if (Array.isArray(data.RelatedTopics)) {
        for (const t of data.RelatedTopics.slice(0, 5)) {
          if (t.Text && t.FirstURL) {
            results.push({ title: t.Text.split(' - ')[0] || q, snippet: t.Text, url: t.FirstURL });
          }
        }
      }
      return { success: true, query: q, count: results.length, results };
    } catch (_) { return null; }
  }

  async _braveSearch(q, safe) {
    const res = await this._httpGet(
      `https://api.search.brave.com/res/v1/web/search?q=${safe}&count=5`,
      { 'Accept-Encoding': 'gzip', 'X-Subscription-Token': BRAVE_API_KEY }
    );
    if (!res.success) return null;
    try {
      const data    = JSON.parse(res.raw);
      const results = ((data.web && data.web.results) || []).slice(0, 5).map((r) => ({
        title:   r.title,
        snippet: r.description || (r.extra_snippets && r.extra_snippets[0]) || '',
        url:     r.url
      }));
      return { success: true, query: q, count: results.length, results };
    } catch (_) { return null; }
  }

  async _googleSearch(q, safe) {
    const res = await this._httpGet(
      `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_API_KEY}&cx=${GOOGLE_CX}&q=${safe}&num=5`
    );
    if (!res.success) return null;
    try {
      const data    = JSON.parse(res.raw);
      const results = (data.items || []).slice(0, 5).map((r) => ({
        title: r.title, snippet: r.snippet || '', url: r.link
      }));
      return { success: true, query: q, count: results.length, results };
    } catch (_) { return null; }
  }

  // ─── 3. openInBrowser ────────────────────────────────────────────────────
  openInBrowser(targetUrl) {
    if (!targetUrl) return false;
    try {
      const cmd = process.platform === 'darwin' ? `open "${targetUrl}"` :
                  process.platform === 'win32'  ? `start "" "${targetUrl}"` : `xdg-open "${targetUrl}"`;
      exec(cmd);
      return true;
    } catch (_) { return false; }
  }

  _extractTitle(html) {
    const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    return m ? m[1].trim() : '';
  }

  _cleanHtml(html) {
    if (!html) return '';
    return html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
      .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, ' ')
      .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ').trim();
  }
}

const browserAgent = new BrowserAgent();
module.exports = { BrowserAgent, browserAgent };
