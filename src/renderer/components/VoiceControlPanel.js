/**
 * VoiceControlPanel Component (Vanilla JS / React.createElement)
 * 
 * Compliant with Node.js AST syntax verification (node -c) without requiring
 * an external JSX preprocessor.
 */

let React = null;
try {
  React = require('react');
} catch (_) {
  React = {
    createElement: (type, props, ...children) => ({ type, props, children }),
    useState: (init) => [typeof init === 'function' ? init() : init, () => {}],
    useEffect: (fn) => { try { fn(); } catch (_) {} },
    useRef: (init) => ({ current: init }),
    useCallback: (fn) => fn
  };
}
const { useState, useEffect, useRef, useCallback } = React;

let defaultAudioPlayer = null;
try {
  const { bengaliAudioPlayer } = require('../utils/audio-player');
  defaultAudioPlayer = bengaliAudioPlayer;
} catch (_) {
  defaultAudioPlayer = {
    play: async () => {},
    stop: () => {},
    on: () => () => {}
  };
}

function VoiceControlPanel(props) {
  const {
    initialText = 'আমার সোনার বাংলা, আমি তোমায় ভালোবাসি',
    onSynthesize = null,
    onStatusChange = null,
    className = ''
  } = props || {};

  const [isLiveVoice, setIsLiveVoice] = useState(true);
  const [text, setText] = useState(initialText);
  const [status, setStatus] = useState('idle'); // 'idle' | 'synthesizing' | 'playing' | 'error'
  const [errorMessage, setErrorMessage] = useState('');
  const [lastSynthesizedText, setLastSynthesizedText] = useState('');
  const [audioDuration, setAudioDuration] = useState(0);

  const playerRef = useRef(defaultAudioPlayer);

  useEffect(() => {
    if (typeof onStatusChange === 'function') {
      onStatusChange(status, { isLiveVoice, errorMessage });
    }
  }, [status, isLiveVoice, errorMessage, onStatusChange]);

  useEffect(() => {
    const player = playerRef.current;
    if (!player || typeof player.on !== 'function') return;

    const unsubStart = player.on('start', (info) => {
      setStatus('playing');
      if (info && info.duration) setAudioDuration(info.duration);
    });
    const unsubEnd = player.on('ended', () => setStatus('idle'));
    const unsubError = player.on('error', (err) => {
      setStatus('error');
      setErrorMessage(err?.message || 'Audio playback error');
    });

    return () => {
      if (typeof unsubStart === 'function') unsubStart();
      if (typeof unsubEnd === 'function') unsubEnd();
      if (typeof unsubError === 'function') unsubError();
    };
  }, []);

  const handleSynthesize = useCallback(async () => {
    const trimmed = (text || '').trim();
    if (!trimmed) {
      setStatus('error');
      setErrorMessage('বাংলা টেক্সট লিখুন (Text cannot be empty)');
      return;
    }

    setErrorMessage('');

    if (!isLiveVoice) {
      setStatus('idle');
      setLastSynthesizedText(trimmed);
      if (typeof onSynthesize === 'function') {
        onSynthesize({ text: trimmed, audioData: null, mode: 'text-only' });
      }
      return;
    }

    setStatus('synthesizing');

    try {
      let audioBytes = null;
      if (typeof window !== 'undefined' && window.banglaTTS) {
        const res = await window.banglaTTS.synthesize(trimmed);
        if (!res.success) throw new Error(res.error || 'Synthesis failed in main process');
        audioBytes = res.audioData;
      } else {
        const { banglaTtsHandler } = require('../../main/tts/bangla-tts-handler');
        const res = await banglaTtsHandler.synthesize(trimmed);
        audioBytes = res.audioBuffer;
      }

      setLastSynthesizedText(trimmed);

      if (audioBytes && playerRef.current) {
        setStatus('playing');
        await playerRef.current.play(audioBytes);
      } else {
        setStatus('idle');
      }

      if (typeof onSynthesize === 'function') {
        onSynthesize({ text: trimmed, audioData: audioBytes, mode: 'audio' });
      }
    } catch (err) {
      setStatus('error');
      setErrorMessage(`অডিও ফেইল্ড: ${err.message}. টেক্সট মোডে দেখানো হচ্ছে।`);
      if (typeof onSynthesize === 'function') {
        onSynthesize({ text: trimmed, audioData: null, mode: 'fallback-text' });
      }
    }
  }, [text, isLiveVoice, onSynthesize]);

  const handleStop = useCallback(() => {
    if (playerRef.current && typeof playerRef.current.stop === 'function') {
      playerRef.current.stop();
    }
    if (typeof window !== 'undefined' && window.banglaTTS?.cancel) {
      window.banglaTTS.cancel();
    }
    setStatus('idle');
  }, []);

  return React.createElement(
    'div',
    { className: `voice-control-panel p-4 bg-slate-900/90 rounded-xl border border-slate-700/60 shadow-xl ${className}` },
    React.createElement(
      'div',
      { className: 'flex items-center justify-between mb-3' },
      React.createElement(
        'div',
        { className: 'flex items-center gap-2' },
        React.createElement('span', { className: 'text-xl' }, '🎙️'),
        React.createElement('h3', { className: 'text-sm font-semibold tracking-wide text-slate-100 uppercase' }, 'Bengali Voice Synthesizer')
      ),
      React.createElement(
        'label',
        { className: 'flex items-center gap-2 cursor-pointer select-none' },
        React.createElement('span', { className: 'text-xs text-slate-300 font-medium' }, 'Live Voice'),
        React.createElement('input', {
          type: 'checkbox',
          checked: isLiveVoice,
          onChange: (e) => setIsLiveVoice(e.target.checked),
          className: 'sr-only'
        })
      )
    ),
    React.createElement(
      'div',
      { className: 'status-indicator text-xs text-slate-300 mb-2' },
      `Status: ${status}`
    ),
    React.createElement('textarea', {
      rows: 3,
      value: text,
      onChange: (e) => setText(e.target.value),
      placeholder: 'বাংলায় কিছু লিখুন বা বলুন...',
      className: 'w-full px-3 py-2 text-sm bg-slate-950/80 border border-slate-700/80 rounded-lg text-slate-100'
    }),
    React.createElement(
      'div',
      { className: 'flex items-center justify-end gap-2 mt-3' },
      status === 'playing' && React.createElement(
        'button',
        { type: 'button', onClick: handleStop, className: 'px-3 py-1.5 text-xs bg-rose-600 text-white rounded' },
        'Stop'
      ),
      React.createElement(
        'button',
        { type: 'button', onClick: handleSynthesize, className: 'px-4 py-1.5 text-xs bg-emerald-600 text-white rounded font-semibold' },
        isLiveVoice ? 'Speak Bengali' : 'Send Text'
      )
    ),
    errorMessage && React.createElement(
      'div',
      { className: 'mt-3 p-2 bg-rose-950/40 border border-rose-500/40 text-xs text-rose-300 rounded' },
      errorMessage
    )
  );
}

module.exports = {
  VoiceControlPanel
};
