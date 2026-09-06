/* eslint-disable import/no-unresolved, import/extensions */
/**
 * MainWindow Lifecycle & Promo Integration Controller
 *
 * Manages the Electron renderer lifecycle for the main window,
 * binds IPC channels for promo surfacing (`promo:show`), and
 * coordinates audio playback delegation across the Electron-Go bridge.
 */

const PromoModal = require('./promoModal.jsx');

class MainWindowManager {
  constructor(options = {}) {
    this.ipc = options.ipc
      || (typeof window !== 'undefined' && (window.electronAPI || window.ipcRenderer))
      || null;
    this.doc = options.document || (typeof document !== 'undefined' ? document : null);
    this.win = options.window || (typeof window !== 'undefined' ? window : null);

    this.state = {
      isPromoOpen: false,
      promoData: null,
      isPlaying: false,
      currentTrackUrl: '',
      lastError: '',
    };

    this.listeners = new Map();
    this.init();
  }

  init() {
    this.registerIpcChannels();
  }

  registerIpcChannels() {
    if (!this.ipc) return;

    // Listen for backend request to display Hila Nina or general promo
    const onPromoShow = (eventOrData, maybeData) => {
      const payload = maybeData !== undefined ? maybeData : eventOrData;
      this.showPromo(payload);
    };

    // Listen for backend request to dismiss promo
    const onPromoClose = () => {
      this.closePromo();
    };

    if (typeof this.ipc.on === 'function') {
      this.ipc.on('promo:show', onPromoShow);
      this.ipc.on('promo:close', onPromoClose);
    }
  }

  showPromo(data = null) {
    this.state.isPromoOpen = true;
    this.state.promoData = data || PromoModal.DEFAULT_PROMO;
    this.state.lastError = '';
    this.emit('promo:state', { ...this.state });
    return this.state;
  }

  closePromo() {
    this.state.isPromoOpen = false;
    this.emit('promo:state', { ...this.state });
    if (this.ipc && typeof this.ipc.send === 'function') {
      this.ipc.send('promo:closed', { id: this.state.promoData?.id });
    }
    return this.state;
  }

  async playTrack(streamUrl, metadata = {}) {
    if (!streamUrl || typeof streamUrl !== 'string' || streamUrl.trim() === '') {
      const err = 'Cannot play track: Invalid streaming URL';
      this.state.lastError = err;
      this.emit('promo:error', err);
      throw new Error(err);
    }

    this.state.isPlaying = true;
    this.state.currentTrackUrl = streamUrl;
    this.state.lastError = '';

    const payload = {
      url: streamUrl,
      title: metadata.title || this.state.promoData?.title || 'Hila Nina',
      artist: metadata.artist || this.state.promoData?.artist || 'Unknown',
    };

    // Dispatch across IPC to Go backend / player service
    if (this.ipc) {
      if (typeof this.ipc.invoke === 'function') {
        try {
          await this.ipc.invoke('player:play-url', payload);
        } catch (err) {
          this.state.isPlaying = false;
          this.state.lastError = err.message || 'Playback IPC error';
          this.emit('promo:error', this.state.lastError);
          throw err;
        }
      } else if (typeof this.ipc.send === 'function') {
        this.ipc.send('player:play-url', payload);
      }
    }

    this.emit('promo:playing', payload);
    return payload;
  }

  on(event, handler) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(handler);
    return () => this.listeners.get(event)?.delete(handler);
  }

  emit(event, data) {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.forEach((fn) => {
        try {
          fn(data);
        } catch (e) {
          console.warn(`[MainWindowManager] Listener error on ${event}:`, e);
        }
      });
    }
  }

  renderModal(props = {}) {
    return PromoModal({
      isOpen: this.state.isPromoOpen,
      onClose: () => this.closePromo(),
      onPlay: (url, meta) => this.playTrack(url, meta),
      promoData: this.state.promoData,
      ...props,
    });
  }
}

function setupMainWindow(options = {}) {
  return new MainWindowManager(options);
}

module.exports = {
  MainWindowManager,
  setupMainWindow,
};
