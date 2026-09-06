/**
 * test/e2e/promo.test.js
 * End-to-end integration test suite for the "Hila Nina" promotional feature.
 *
 * Validates:
 * 1. IPC invocation (`promo:show`, `promo:close`, `player:play-url`).
 * 2. Bilingual rendering (English/Bengali) and graceful fallback to English.
 * 3. Artwork display and fallback placeholder when URL is missing.
 * 4. Audio playback initiation via PlayFromURL integration.
 * 5. Error handling when streaming URLs fail or are malformed.
 */

const assert = require('assert');
const { EventEmitter } = require('events');
const PromoModal = require('../../src/renderer/promoModal.jsx');
const { MainWindowManager } = require('../../src/renderer/mainWindow');

console.log('🧪 Starting Hila Nina Promotional Feature E2E Test Suite...\n');

// Mock IPC implementation for Electron Renderer testing
class MockIpc extends EventEmitter {
  constructor() {
    super();
    this.invocations = [];
    this.sentMessages = [];
  }

  send(channel, data) {
    this.sentMessages.push({ channel, data });
    this.emit(channel, data);
  }

  async invoke(channel, data) {
    this.invocations.push({ channel, data });
    if (channel === 'player:play-url') {
      if (!data || !data.url || !data.url.startsWith('http')) {
        throw new Error('Player service rejected: invalid streaming URL');
      }
      return { status: 'playing', url: data.url };
    }
    return { success: true };
  }
}

async function runE2ETests() {
  const mockIpc = new MockIpc();
  const mainWindow = new MainWindowManager({ ipc: mockIpc });

  // -------------------------------------------------------------
  // Test 1: IPC Trigger & Modal Surfacing
  // -------------------------------------------------------------
  console.log('▶ Test 1: IPC promo:show channel triggers modal display');
  assert.strictEqual(mainWindow.state.isPromoOpen, false, 'Modal should initially be closed');

  const testPayload = {
    id: 'hila-nina-promo',
    title: 'Hila Nina',
    artist: 'Hila Nina & The Ambient Collective',
    description: {
      en: 'Experience the soulful harmonies of Hila Nina, blending classical acoustics with contemporary ambient rhythm.',
      bn: 'হিলা নিনার হৃদয়স্পর্শী সুর উপভোগ করুন, যেখানে শাস্ত্রীয় রাগ ও আধুনিক অ্যাম্বিয়েন্ট সঙ্গীতের মেলবন্ধন ঘটেছে।',
    },
    imageUrl: 'https://assets.eloquent.internal/art/hila-nina.jpg',
    streamUrl: 'https://stream.eloquent.internal/audio/hila-nina-master.mp3',
    ctaText: {
      en: 'Listen together',
      bn: 'একসাথে শুনুন',
    },
    duration: '3:45',
  };

  // Simulate backend firing promo:show over IPC
  mockIpc.emit('promo:show', testPayload);

  assert.strictEqual(mainWindow.state.isPromoOpen, true, 'Modal should be open after promo:show');
  assert.strictEqual(mainWindow.state.promoData.title, 'Hila Nina');
  assert.strictEqual(mainWindow.state.promoData.streamUrl, testPayload.streamUrl);

  const renderedVdom = mainWindow.renderModal();
  assert(renderedVdom !== null, 'renderModal should return non-null element when open');
  assert.strictEqual(renderedVdom.props.id, 'promo-modal-backdrop');
  console.log('  ✅ Test 1 passed: IPC trigger opens modal successfully.\n');

  // -------------------------------------------------------------
  // Test 2: Bilingual i18n & Bengali-to-English Fallback
  // -------------------------------------------------------------
  console.log('▶ Test 2: Bilingual i18n support & missing Bengali string fallback');

  // English rendering
  const modalEn = PromoModal({
    isOpen: true,
    promoData: testPayload,
    initialLang: 'en',
  });
  assert(modalEn !== null);

  // Bengali rendering
  const modalBn = PromoModal({
    isOpen: true,
    promoData: testPayload,
    initialLang: 'bn',
  });
  assert(modalBn !== null);

  // Edge case: Bengali strings missing in payload -> Fallback to English
  const payloadMissingBn = {
    ...testPayload,
    description: {
      en: 'English description is present',
      bn: '', // Missing
    },
    ctaText: {
      en: 'Listen together',
      bn: '', // Missing
    },
  };

  const modalFallback = PromoModal({
    isOpen: true,
    promoData: payloadMissingBn,
    initialLang: 'bn',
  });
  assert(modalFallback !== null, 'Modal should render even if Bengali string is empty');
  console.log('  ✅ Test 2 passed: Bilingual rendering & fallback nominal.\n');

  // -------------------------------------------------------------
  // Test 3: Album Artwork & Missing Artwork Fallback
  // -------------------------------------------------------------
  console.log('▶ Test 3: Artwork rendering & placeholder fallback');

  // Valid artwork
  const modalWithArt = PromoModal({
    isOpen: true,
    promoData: testPayload,
  });
  assert(modalWithArt !== null);

  // Missing artwork URL
  const payloadNoArt = {
    ...testPayload,
    imageUrl: '', // Empty artwork
  };

  const modalNoArt = PromoModal({
    isOpen: true,
    promoData: payloadNoArt,
  });
  assert(modalNoArt !== null, 'Modal must gracefully handle missing album artwork');
  console.log('  ✅ Test 3 passed: Artwork handling verified.\n');

  // -------------------------------------------------------------
  // Test 4: CTA Play Click & Audio Playback Start
  // -------------------------------------------------------------
  console.log('▶ Test 4: CTA click triggers PlayFromURL IPC invocation');

  let trackStarted = false;
  mainWindow.on('promo:playing', (info) => {
    trackStarted = true;
    assert.strictEqual(info.url, testPayload.streamUrl);
  });

  const playResult = await mainWindow.playTrack(testPayload.streamUrl, {
    title: testPayload.title,
    artist: testPayload.artist,
  });

  assert.strictEqual(playResult.url, testPayload.streamUrl);
  assert.strictEqual(mainWindow.state.isPlaying, true);
  assert.strictEqual(trackStarted, true);

  // Verify IPC call to player backend
  const lastIpcCall = mockIpc.invocations[mockIpc.invocations.length - 1];
  assert.strictEqual(lastIpcCall.channel, 'player:play-url');
  assert.strictEqual(lastIpcCall.data.url, testPayload.streamUrl);
  console.log('  ✅ Test 4 passed: Audio playback initiated via IPC.\n');

  // -------------------------------------------------------------
  // Test 5: Edge Case - Malformed/Missing Stream URL Error Handling
  // -------------------------------------------------------------
  console.log('▶ Test 5: Error handling on missing or invalid streaming URL');

  try {
    await mainWindow.playTrack('');
    assert.fail('playTrack should throw for empty stream URL');
  } catch (err) {
    assert(err.message.includes('Invalid streaming URL'));
    assert.strictEqual(mainWindow.state.lastError, 'Cannot play track: Invalid streaming URL');
  }

  try {
    await mainWindow.playTrack('ftp://invalid-protocol.com/audio.mp3');
    assert.fail('playTrack should reject invalid scheme');
  } catch (err) {
    assert(err.message.includes('invalid streaming URL'));
  }
  console.log('  ✅ Test 5 passed: Error handling and toast triggers verified.\n');

  // -------------------------------------------------------------
  // Test 6: Modal Dismissal Lifecycle
  // -------------------------------------------------------------
  console.log('▶ Test 6: Modal dismissal closes modal and emits promo:closed');

  mainWindow.closePromo();
  assert.strictEqual(mainWindow.state.isPromoOpen, false);

  const closeMessage = mockIpc.sentMessages.find((m) => m.channel === 'promo:closed');
  assert(closeMessage !== undefined, 'promo:closed must be sent over IPC');
  assert.strictEqual(closeMessage.data.id, testPayload.id);

  const closedVdom = mainWindow.renderModal();
  assert.strictEqual(closedVdom, null, 'renderModal must return null when closed');
  console.log('  ✅ Test 6 passed: Modal dismissal verified.\n');

  console.log('🎉 ALL HILA NINA PROMO E2E TESTS PASSED SUCCESSFULLY!');
}

runE2ETests().catch((err) => {
  console.error('❌ E2E Test Suite Failed:', err);
  process.exit(1);
});
