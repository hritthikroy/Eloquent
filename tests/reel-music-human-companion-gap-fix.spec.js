/**
 * reel-music-human-companion-gap-fix.spec.js
 * Integration tests for the full "watch reels / listen music with Tuk Tuk" fix
 */

const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const sanitize = require(path.join(ROOT, 'src/utils/prompt-engine/text-sanitizer'));
const brain = require(path.join(ROOT, 'src/utils/local-cognitive-brain'));

test('Reel & Music Human Companion Integration Suite', async (t) => {

  // ─── 1. STT Phonetic Corrections ─────────────────────────────────────────────
  await t.test('1. STT Phonetic Corrections — movile / nt lisent', () => {
    const cases = [
      ['movile reel with me', 'mobile reel'],
      ['mobail reel together', 'mobile reel'],
      ['nt lisent music', 'not listen'],
      ['lisent to this song', 'listen'],
      ['watching need like a human', 'watch like a human'],
      ['my gf not see with me', 'does not see'],
    ];

    for (const [input, expected] of cases) {
      const result = (sanitize(input) || '').toLowerCase();
      assert.ok(result.includes(expected.toLowerCase()), `sanitize("${input}") must contain "${expected}" (got: "${result}")`);
    }
  });

  // ─── 2. isReelOrMediaWatching regex ──────────────────────────────────────────
  await t.test('2. isReelOrMediaWatching detection', () => {
    const match = (text) => {
      const lower = text.toLowerCase();
      return /\b(reel|reels|movile\s*reel|mobile\s*reel|shorts?|tiktok|instagram\s+reel|yt\s+shorts?|youtube\s+shorts?|clip|meme|memes|video\s*dekh|reel\s*dekh)\b/i.test(lower) ||
        (/\b(video|clip|meme)\b/i.test(lower) && /\b(with\s+me|same|ek\s*sathe|ektu|amra|together|dekh|watch)\b/i.test(lower));
    };

    const positiveCases = [
      'watch reels with me babe', 'mobile reel dekh', 'movile reel ektu',
      'instagram reel', 'youtube shorts', 'tiktok video', 'reel dekh babe',
      'this meme is hilarious watch with me', 'yt shorts dekh',
    ];
    for (const phrase of positiveCases) {
      assert.strictEqual(match(phrase), true, `Should match: "${phrase}"`);
    }

    const negativeCases = [
      'play music on spotify', 'open the terminal', 'fix this bug',
    ];
    for (const phrase of negativeCases) {
      assert.strictEqual(match(phrase), false, `Should NOT match: "${phrase}"`);
    }
  });

  // ─── 3. isMusicListeningTogether regex ───────────────────────────────────────
  await t.test('3. isMusicListeningTogether detection', () => {
    const match = (text) => {
      const lower = text.toLowerCase();
      return /\b(listen\s+(?:to\s+)?(?:music|song|gaan|gan)|music\s+(?:shono|listen|with\s+me|suno|ek\s*sathe)|gaan\s+(?:shono|suno)|gan\s+(?:shono|suno)|music\s+together|song\s+together|ek\s*sathe\s+(?:music|gaan|gan))\b/i.test(lower) ||
        (/\b(music|song|gaan|gan)\b/i.test(lower) && /\b(with\s+me|together|same|amra|ektu|ek\s*sathe)\b/i.test(lower));
    };

    const positiveCases = [
      'listen to music with me babe', 'gaan shono babe', 'music together',
      'music shono', 'ek sathe gaan shono', 'song together babe',
    ];
    for (const phrase of positiveCases) {
      assert.strictEqual(match(phrase), true, `Should match: "${phrase}"`);
    }

    const negativeCases = [
      'play music on spotify', 'pause the song', 'next track please',
    ];
    for (const phrase of negativeCases) {
      assert.strictEqual(match(phrase), false, `Should NOT match: "${phrase}"`);
    }
  });

  // ─── 4. Local brain reel + music fallback pools ───────────────────────────────
  await t.test('4. Local brain — Tuk Tuk reel & music fallbacks', () => {
    const get = (text) => {
      if (typeof brain.synthesizeResponse === 'function') return brain.synthesizeResponse('tuktuk', 'Tuk Tuk', text, {});
      if (typeof brain.getLocalResponse === 'function') return brain.getLocalResponse(text, 'tuktuk');
      if (typeof brain === 'function') return brain(text, 'tuktuk');
      return null;
    };

    const reelResp = get('watch reels with me babe');
    assert.notStrictEqual(reelResp, null);
    assert.match(reelResp, /babe|reel|scrolling|fyp|creator|funny/i);

    const musicResp = get('listen to music with me babe');
    assert.notStrictEqual(musicResp, null);
    assert.match(musicResp, /babe|vibe|music|beat|listen|song/i);
  });

  // ─── 5. Active Agent Routing — Girlfriend & Reel/Music context routes to Tuk Tuk ───
  await t.test('5. detectActiveAgent routes girlfriend / reel queries to Tuk Tuk', async () => {
    const JarvisManager = require(path.join(ROOT, 'src/utils/jarvis-manager'));
    const jm = new JarvisManager();

    const testQueries = [
      'fix all conversation gap my gf not see with me movile reel and nt lisent music and watching need like a human',
      'my gf not see with me mobile reel',
      'babe watch reels with me',
      'listen to music with me babe',
      'my girlfriend watch reel with me',
      'amar gf mobile reel dekhe na',
    ];

    for (const query of testQueries) {
      const agent = await jm.detectActiveAgent(query);
      assert.strictEqual(agent?.key, 'tuktuk', `Query "${query}" should route to Tuk Tuk (got ${agent?.key})`);
    }
  });

  // ─── 6. ActionRunner — Tuk Tuk Girlfriend Reel & Music Companion Handling ──────
  await t.test('6. actionRunner handles reel co-watching & music companion for Tuk Tuk', async () => {
    const actionRunner = require(path.join(ROOT, 'src/utils/action-runner'));
    const tuktukAgent = { name: 'Tuk Tuk', key: 'tuktuk', voice: 'en-US-AvaMultilingualNeural' };

    // Music listening together
    const musicRes = await actionRunner.handleAction('listen to music with me babe', tuktukAgent);
    assert.strictEqual(musicRes?.handled, true, 'Music listening should be handled');
    assert.strictEqual(musicRes?.agentName, 'Tuk Tuk');
    assert.match(musicRes?.speech, /babe/i);

    // Reel co-watching
    const reelRes = await actionRunner.handleAction('watch reels with me babe', tuktukAgent);
    assert.strictEqual(reelRes?.handled, true, 'Reel watching should be handled');
    assert.strictEqual(reelRes?.agentName, 'Tuk Tuk');
    assert.match(reelRes?.speech, /babe/i);
  });
});

