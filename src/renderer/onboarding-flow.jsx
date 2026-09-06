/**
 * Adaptive Onboarding Flow Component (JSX Companion)
 *
 * Consumes real-time UX metrics and sliding window anomaly alerts
 * from the Electron main process and Go audio backend.
 * Dynamically switches to a simplified, friction-free interface
 * when users exhibit high friction signals (rapid backtracking, long idle time).
 */

let React = null;
try {
  React = require('react');
} catch (e) {
  React = {
    useState: (init) => [init, () => {}],
    useEffect: () => {},
    useRef: (init) => ({ current: init }),
    useCallback: (fn) => fn,
    createElement: (type, props, ...children) => ({ type, props, children }),
  };
}
const { useState, useEffect, useRef, useCallback } = React;

const FULL_STEPS = [
  { id: 'welcome_audio', title: 'Audio & Microphone Setup', subtitle: 'Select and calibrate your input device' },
  { id: 'persona_select', title: 'Select AI Co-Pilot', subtitle: 'Choose your default squad voice personality' },
  { id: 'hotkey_config', title: 'Global Hotkey & Trigger', subtitle: 'Configure hands-free dictation triggers' },
  { id: 'quick_practice', title: 'Voice Test & Verification', subtitle: 'Speak a quick sample sentence to verify latency' },
  { id: 'setup_complete', title: 'All Systems Nominal', subtitle: 'You are ready for sub-200ms instantaneous voice workflow' },
];

const SIMPLIFIED_STEPS = [
  { id: 'express_setup', title: 'Express Auto-Calibration', subtitle: 'Optimal microphone and hotkey settings applied automatically' },
  { id: 'setup_complete', title: 'Ready to Speak', subtitle: 'Start dictating instantly' },
];

function OnboardingFlow({ onComplete, onSkip, initialStep = 0, enableTelemetry = true }) {
  const [currentStepIndex, setCurrentStepIndex] = useState(initialStep);
  const [simplifiedMode, setSimplifiedMode] = useState(false);
  const [backtrackCount, setBacktrackCount] = useState(0);
  const [activeAlerts, setActiveAlerts] = useState([]);
  const [frictionDetected, setFrictionDetected] = useState(false);
  const [frictionReason, setFrictionReason] = useState('');

  const [selectedMic, setSelectedMic] = useState('Default Built-in Microphone');
  const [selectedPersona, setSelectedPersona] = useState('tuktuk');
  const [hotkey, setHotkey] = useState('Ctrl + Space');
  const [testSpeechConfirmed, setTestSpeechConfirmed] = useState(false);

  const stepStartTimeRef = useRef(Date.now());
  const idleTimerRef = useRef(null);
  const sessionIdRef = useRef(`sess-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`);

  const activeSteps = simplifiedMode ? SIMPLIFIED_STEPS : FULL_STEPS;
  const currentStep = activeSteps[currentStepIndex] || activeSteps[0];

  const emitInteraction = useCallback(
    (event) => {
      if (!enableTelemetry) return;
      const fullEvent = {
        eventType: event.eventType || 'click',
        stepId: event.stepId || currentStep.id,
        stepIndex: currentStepIndex,
        dwellTimeMs: event.dwellTimeMs || Date.now() - stepStartTimeRef.current,
        idleDurationMs: event.idleDurationMs || 0,
        backtrackCount: event.backtrackCount !== undefined ? event.backtrackCount : backtrackCount,
        timestamp: Date.now(),
        sessionId: sessionIdRef.current,
        metadata: event.metadata || {},
      };

      try {
        if (typeof window !== 'undefined') {
          const electronAPI = window.electronAPI;
          const analyticsAPI = window.analyticsAPI;
          if (analyticsAPI && typeof analyticsAPI.trackEvent === 'function') {
            analyticsAPI.trackEvent(fullEvent);
          } else if (electronAPI && electronAPI.analytics && typeof electronAPI.analytics.trackEvent === 'function') {
            electronAPI.analytics.trackEvent(fullEvent);
          }
        }
      } catch {
        // Ignore
      }
    },
    [backtrackCount, currentStep.id, currentStepIndex, enableTelemetry]
  );

  const resetIdleTimer = useCallback(() => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
    }

    idleTimerRef.current = setTimeout(() => {
      emitInteraction({
        eventType: 'idle_timeout',
        idleDurationMs: 8000,
      });

      setFrictionDetected(true);
      setFrictionReason('You seem to be spending some time here. We streamlined the process for you!');
      setSimplifiedMode(true);
    }, 8000);
  }, [emitInteraction]);

  useEffect(() => {
    let unsubscribe = null;
    try {
      if (typeof window !== 'undefined') {
        const electronAPI = window.electronAPI;
        const analyticsAPI = window.analyticsAPI;
        const handler = (alert) => {
          setActiveAlerts((prev) => [alert, ...prev].slice(0, 5));
          if (alert.alertType === 'user_friction_high' || alert.alertType === 'excessive_backtracking') {
            setFrictionDetected(true);
            setFrictionReason(alert.details || 'High friction detected. Switched to express setup.');
            setSimplifiedMode(true);
          }
        };

        if (analyticsAPI && typeof analyticsAPI.onAnomalyAlert === 'function') {
          unsubscribe = analyticsAPI.onAnomalyAlert(handler);
        } else if (electronAPI && electronAPI.analytics && typeof electronAPI.analytics.onAnomalyAlert === 'function') {
          unsubscribe = electronAPI.analytics.onAnomalyAlert(handler);
        }
      }
    } catch {
      // Ignore
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  useEffect(() => {
    resetIdleTimer();
    const handleActivity = () => resetIdleTimer();

    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('click', handleActivity);

    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('click', handleActivity);
    };
  }, [resetIdleTimer]);

  const handleNextStep = () => {
    const dwell = Date.now() - stepStartTimeRef.current;
    emitInteraction({
      eventType: 'step_complete',
      dwellTimeMs: dwell,
    });

    if (currentStepIndex < activeSteps.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
      stepStartTimeRef.current = Date.now();
    } else {
      emitInteraction({ eventType: 'step_complete', stepId: 'setup_complete' });
      if (onComplete) {
        onComplete({
          mic: selectedMic,
          persona: selectedPersona,
          hotkey,
          simplifiedMode,
          backtrackCount,
        });
      }
    }
  };

  const handlePreviousStep = () => {
    if (currentStepIndex > 0) {
      const newBacktracks = backtrackCount + 1;
      setBacktrackCount(newBacktracks);

      emitInteraction({
        eventType: 'backtrack',
        backtrackCount: newBacktracks,
      });

      if (newBacktracks >= 2 && !simplifiedMode) {
        setFrictionDetected(true);
        setFrictionReason('Multiple step changes detected. Switched to simplified mode with automatic defaults.');
        setSimplifiedMode(true);
        setCurrentStepIndex(0);
        return;
      }

      setCurrentStepIndex(currentStepIndex - 1);
      stepStartTimeRef.current = Date.now();
    }
  };

  const handleToggleSimplified = () => {
    const newMode = !simplifiedMode;
    setSimplifiedMode(newMode);
    setCurrentStepIndex(0);
    emitInteraction({
      eventType: 'toggle_simplified_mode',
      metadata: { simplified: newMode },
    });
  };

  return React.createElement(
    'div',
    { className: 'flex flex-col w-full max-w-2xl mx-auto p-6 bg-slate-900 text-slate-100 rounded-xl shadow-2xl border border-slate-800' },
    React.createElement(
      'div',
      { className: 'flex items-center justify-between pb-4 mb-4 border-b border-slate-800' },
      React.createElement(
        'div',
        null,
        React.createElement(
          'h2',
          { className: 'text-xl font-bold tracking-tight text-indigo-400' },
          simplifiedMode ? '⚡ Express Voice Onboarding' : '🎙️ Eloquent Audio Onboarding'
        ),
        React.createElement(
          'p',
          { className: 'text-xs text-slate-400' },
          `Step ${currentStepIndex + 1} of ${activeSteps.length}: ${currentStep.title}`
        )
      ),
      React.createElement(
        'div',
        { className: 'flex items-center space-x-2' },
        React.createElement(
          'button',
          {
            onClick: handleToggleSimplified,
            className: 'px-2.5 py-1 text-xs rounded-md border border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/10 transition',
          },
          simplifiedMode ? 'Switch to Detailed Mode' : 'Simplify Steps'
        ),
        onSkip &&
          React.createElement(
            'button',
            {
              onClick: onSkip,
              className: 'px-2.5 py-1 text-xs text-slate-400 hover:text-slate-200 transition',
            },
            'Skip'
          )
      )
    ),
    frictionDetected &&
      React.createElement(
        'div',
        { className: 'mb-4 p-3 rounded-lg bg-indigo-950/60 border border-indigo-500/40 text-xs text-indigo-200 flex items-start space-x-2' },
        React.createElement('span', { className: 'text-base' }, '💡'),
        React.createElement('div', { className: 'flex-1' }, React.createElement('span', { className: 'font-semibold text-indigo-300' }, 'Adaptive Assistant: '), frictionReason),
        React.createElement('button', { onClick: () => setFrictionDetected(false), className: 'text-slate-400 hover:text-slate-200 text-xs' }, '✕')
      ),
    activeAlerts.length > 0 &&
      React.createElement(
        'div',
        { className: 'mb-4 p-2.5 rounded-lg bg-amber-950/40 border border-amber-600/30 text-xs text-amber-200' },
        React.createElement('span', { className: 'font-semibold text-amber-400' }, '⚠️ Audio Pipeline Telemetry: '),
        activeAlerts[0].details
      ),
    React.createElement(
      'div',
      { className: 'flex items-center justify-between pt-4 mt-2 border-t border-slate-800' },
      React.createElement(
        'button',
        {
          onClick: handlePreviousStep,
          disabled: currentStepIndex === 0,
          className: 'px-4 py-1.5 text-xs font-medium rounded-md border border-slate-700 text-slate-300 hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition',
        },
        'Back'
      ),
      React.createElement(
        'button',
        {
          onClick: handleNextStep,
          className: 'px-5 py-1.5 text-xs font-semibold rounded-md bg-indigo-600 hover:bg-indigo-500 text-white shadow transition',
        },
        currentStepIndex === activeSteps.length - 1 ? 'Finish' : 'Continue'
      )
    )
  );
}

module.exports = OnboardingFlow;
module.exports.OnboardingFlow = OnboardingFlow;
module.exports.default = OnboardingFlow;
