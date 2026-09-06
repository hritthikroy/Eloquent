/**
 * src/renderer/components/FastLearnerToggle.jsx
 * 
 * FastLearnerToggle React Component
 * Renders a toggle switch component, persisting state to localStorage,
 * and invoking FastLearner.startSession / stopSession.
 */

import React, { useState, useEffect, useRef } from 'react';
import { FastLearner } from '../fastLearner';

export const FastLearnerToggle = ({
  className = '',
  style = {},
  onToggleChange
}) => {
  const [isEnabled, setIsEnabled] = useState(false);
  const [progressText, setProgressText] = useState('');
  const debounceTimer = useRef(null);

  useEffect(() => {
    const learner = FastLearner.getInstance();
    learner.init();

    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const savedState = window.localStorage.getItem('fast_learner_enabled');
        if (savedState === 'true') {
          setIsEnabled(true);
          learner.startSession();
        }
      }
    } catch (e) {
      console.warn('[FastLearnerToggle] LocalStorage access warning:', e);
    }

    const unsubscribe = learner.onProgress((data) => {
      if (data && data.progress && data.progress.currentPrompt) {
        setProgressText(data.progress.currentPrompt);
      }
    });

    return () => {
      unsubscribe();
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, []);

  const handleToggle = () => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    const nextState = !isEnabled;
    setIsEnabled(nextState);

    // Rapid toggle spam protection (150ms debounce)
    debounceTimer.current = setTimeout(() => {
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem('fast_learner_enabled', String(nextState));
        }
      } catch (e) {
        // Safe swallow
      }

      const learner = FastLearner.getInstance();
      if (nextState) {
        learner.startSession();
      } else {
        learner.stopSession();
      }

      if (typeof onToggleChange === 'function') {
        onToggleChange(nextState);
      }
    }, 150);
  };

  return (
    <div
      className={`fast-learner-toggle-container ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '12px',
        padding: '8px 14px',
        borderRadius: '20px',
        backgroundColor: isEnabled ? 'rgba(59, 130, 246, 0.15)' : 'rgba(100, 116, 139, 0.15)',
        border: `1px solid ${isEnabled ? '#3b82f6' : '#64748b'}`,
        transition: 'all 0.3s ease',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '13px',
        color: '#e2e8f0',
        ...style
      }}
    >
      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          cursor: 'pointer',
          userSelect: 'none'
        }}
      >
        <span style={{ fontWeight: 600 }}>🚀 Fast Learner Mode</span>
        <input
          type="checkbox"
          checked={isEnabled}
          onChange={handleToggle}
          style={{
            width: '18px',
            height: '18px',
            accentColor: '#3b82f6',
            cursor: 'pointer'
          }}
        />
      </label>
      {isEnabled && progressText && (
        <span
          style={{
            fontSize: '12px',
            color: '#93c5fd',
            fontStyle: 'italic',
            marginLeft: '4px'
          }}
        >
          [{progressText}]
        </span>
      )}
    </div>
  );
};

export default FastLearnerToggle;
