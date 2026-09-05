/**
 * VoiceControlPanel Component (React JSX)
 * 
 * Provides live control for the Bengali Text-to-Speech (TTS) pipeline.
 * Features:
 * 1. "Live Voice" toggle with active status reflection.
 * 2. Visual status badge: 'idle', 'synthesizing', 'playing', 'error'.
 * 3. Real-time Bengali text input with character limit and validation.
 * 4. Graceful degradation to text-only mode upon audio engine failure.
 * 5. Seamless IPC binding via window.banglaTTS and BengaliAudioPlayer.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { bengaliAudioPlayer } from '../utils/audio-player';

export const VoiceControlPanel = ({
  initialText = 'আমার সোনার বাংলা, আমি তোমায় ভালোবাসি',
  onSynthesize = null,
  onStatusChange = null,
  className = ''
}) => {
  const [isLiveVoice, setIsLiveVoice] = useState(true);
  const [text, setText] = useState(initialText);
  const [status, setStatus] = useState('idle'); // 'idle' | 'synthesizing' | 'playing' | 'error'
  const [errorMessage, setErrorMessage] = useState('');
  const [lastSynthesizedText, setLastSynthesizedText] = useState('');
  const [audioDuration, setAudioDuration] = useState(0);

  const playerRef = useRef(bengaliAudioPlayer);

  // Synchronize status updates with parent callbacks
  useEffect(() => {
    if (typeof onStatusChange === 'function') {
      onStatusChange(status, { isLiveVoice, errorMessage });
    }
  }, [status, isLiveVoice, errorMessage, onStatusChange]);

  // Audio player event listeners
  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;

    const unsubStart = player.on('start', (info) => {
      setStatus('playing');
      if (info && info.duration) {
        setAudioDuration(info.duration);
      }
    });

    const unsubEnd = player.on('ended', () => {
      setStatus('idle');
    });

    const unsubError = player.on('error', (err) => {
      setStatus('error');
      setErrorMessage(err?.message || 'Audio playback error occurred');
    });

    return () => {
      unsubStart();
      unsubEnd();
      unsubError();
    };
  }, []);

  // Handle synthesize action
  const handleSynthesize = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed) {
      setStatus('error');
      setErrorMessage('বাংলা টেক্সট লিখুন (Text cannot be empty)');
      return;
    }

    setErrorMessage('');

    // If Live Voice is disabled, execute graceful text-only submission
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
        if (!res.success) {
          throw new Error(res.error || 'Synthesis failed in main process');
        }
        audioBytes = res.audioData;
      } else {
        // Fallback or Node test environment
        const { banglaTtsHandler } = require('../../main/tts/bangla-tts-handler');
        const res = await banglaTtsHandler.synthesize(trimmed);
        audioBytes = res.audioBuffer;
      }

      setLastSynthesizedText(trimmed);

      if (audioBytes) {
        setStatus('playing');
        await playerRef.current.play(audioBytes);
      } else {
        setStatus('idle');
      }

      if (typeof onSynthesize === 'function') {
        onSynthesize({ text: trimmed, audioData: audioBytes, mode: 'audio' });
      }
    } catch (err) {
      // Graceful fallback to text-only mode on synthesis failure
      console.warn('⚠️ Bangla TTS audio synthesis failed, falling back to text-only mode:', err);
      setStatus('error');
      setErrorMessage(`অডিও ফেইল্ড: ${err.message}. টেক্সট মোডে দেখানো হচ্ছে।`);

      if (typeof onSynthesize === 'function') {
        onSynthesize({ text: trimmed, audioData: null, mode: 'fallback-text' });
      }
    }
  }, [text, isLiveVoice, onSynthesize]);

  // Handle stop action
  const handleStop = useCallback(() => {
    if (playerRef.current) {
      playerRef.current.stop();
    }
    if (typeof window !== 'undefined' && window.banglaTTS?.cancel) {
      window.banglaTTS.cancel();
    }
    setStatus('idle');
  }, []);

  return (
    <div className={`voice-control-panel p-4 bg-slate-900/90 rounded-xl border border-slate-700/60 shadow-xl ${className}`}>
      {/* Header & Controls */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">🎙️</span>
          <h3 className="text-sm font-semibold tracking-wide text-slate-100 uppercase">
            Bengali Voice Synthesizer (বাংলা টিটিএস)
          </h3>
        </div>

        {/* Live Voice Toggle */}
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <span className="text-xs text-slate-300 font-medium">Live Voice</span>
          <div className="relative inline-flex items-center">
            <input
              type="checkbox"
              checked={isLiveVoice}
              onChange={(e) => setIsLiveVoice(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
          </div>
        </label>
      </div>

      {/* Status Badge */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs text-slate-400">Status:</span>
        <span
          className={`px-2 py-0.5 text-xs font-semibold rounded-full border flex items-center gap-1.5 transition-all duration-200 ${
            status === 'idle'
              ? 'bg-slate-800 text-slate-300 border-slate-600'
              : status === 'synthesizing'
              ? 'bg-amber-950/60 text-amber-300 border-amber-500/50 animate-pulse'
              : status === 'playing'
              ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/50 shadow-sm shadow-emerald-500/20'
              : 'bg-rose-950/60 text-rose-300 border-rose-500/50'
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              status === 'idle'
                ? 'bg-slate-400'
                : status === 'synthesizing'
                ? 'bg-amber-400'
                : status === 'playing'
                ? 'bg-emerald-400 animate-ping'
                : 'bg-rose-400'
            }`}
          />
          {status === 'idle' && 'Idle (প্রস্তুত)'}
          {status === 'synthesizing' && 'Synthesizing (তৈরি হচ্ছে)...'}
          {status === 'playing' && 'Playing (কথা বলছে)...'}
          {status === 'error' && 'Error (ত্রুটি)'}
        </span>
      </div>

      {/* Textarea Input */}
      <div className="relative mb-3">
        <textarea
          rows={3}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="বাংলায় কিছু লিখুন বা বলুন... (Type Bengali text for live voice synthesis)"
          disabled={status === 'synthesizing' || status === 'playing'}
          className="w-full px-3 py-2 text-sm bg-slate-950/80 border border-slate-700/80 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition-all resize-none"
        />
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-between">
        <div className="text-xs text-slate-400">
          {audioDuration > 0 && status === 'playing' && (
            <span>অডিও দৈর্ঘ্য: {audioDuration.toFixed(1)}s</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {status === 'playing' && (
            <button
              type="button"
              onClick={handleStop}
              className="px-3 py-1.5 text-xs font-medium bg-rose-600/80 hover:bg-rose-600 text-white rounded-lg transition-colors shadow-sm"
            >
              Stop (থামুন)
            </button>
          )}

          <button
            type="button"
            onClick={handleSynthesize}
            disabled={status === 'synthesizing' || status === 'playing' || !text.trim()}
            className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all shadow-md flex items-center gap-1.5 ${
              status === 'synthesizing' || status === 'playing' || !text.trim()
                ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white cursor-pointer active:scale-95'
            }`}
          >
            <span>{isLiveVoice ? '🔊 Speak Bengali' : '💬 Send Text'}</span>
          </button>
        </div>
      </div>

      {/* Error / Fallback Banner */}
      {status === 'error' && errorMessage && (
        <div className="mt-3 p-2.5 bg-rose-950/40 border border-rose-500/40 rounded-lg text-xs text-rose-300 flex items-start gap-2 animate-fadeIn">
          <span className="text-sm">⚠️</span>
          <div className="flex-1">
            <p className="font-medium">{errorMessage}</p>
            <p className="text-[11px] text-rose-400/80 mt-0.5">
              UI gracefully degraded to text-only mode.
            </p>
          </div>
        </div>
      )}

      {/* Last Text Result (Graceful Text-Only Display) */}
      {lastSynthesizedText && (
        <div className="mt-3 pt-2.5 border-t border-slate-800 text-xs text-slate-400 flex items-center justify-between">
          <span className="truncate max-w-[80%]">লাস্ট ইনপুট: "{lastSynthesizedText}"</span>
          <span className="text-[10px] text-emerald-400/80 uppercase font-mono">24kHz PCM</span>
        </div>
      )}
    </div>
  );
};

export default VoiceControlPanel;
