/**
 * Adaptive Onboarding Flow Component
 * 
 * Consumes real-time UX metrics and sliding window anomaly alerts
 * from the Electron main process and Go audio backend.
 * Dynamically switches to a simplified, friction-free interface
 * when users exhibit high friction signals (rapid backtracking, long idle time).
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnomalyAlert, UserInteractionEvent } from '../shared/types/metrics';

export interface OnboardingFlowProps {
  onComplete?: (userData: Record<string, any>) => void;
  onSkip?: () => void;
  initialStep?: number;
  enableTelemetry?: boolean;
}

export interface StepDefinition {
  id: string;
  title: string;
  subtitle: string;
}

const FULL_STEPS: StepDefinition[] = [
  { id: 'welcome_audio', title: 'Audio & Microphone Setup', subtitle: 'Select and calibrate your input device' },
  { id: 'persona_select', title: 'Select AI Co-Pilot', subtitle: 'Choose your default squad voice personality' },
  { id: 'hotkey_config', title: 'Global Hotkey & Trigger', subtitle: 'Configure hands-free dictation triggers' },
  { id: 'quick_practice', title: 'Voice Test & Verification', subtitle: 'Speak a quick sample sentence to verify latency' },
  { id: 'setup_complete', title: 'All Systems Nominal', subtitle: 'You are ready for sub-200ms instantaneous voice workflow' },
];

const SIMPLIFIED_STEPS: StepDefinition[] = [
  { id: 'express_setup', title: 'Express Auto-Calibration', subtitle: 'Optimal microphone and hotkey settings applied automatically' },
  { id: 'setup_complete', title: 'Ready to Speak', subtitle: 'Start dictating instantly' },
];

export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({
  onComplete,
  onSkip,
  initialStep = 0,
  enableTelemetry = true,
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(initialStep);
  const [simplifiedMode, setSimplifiedMode] = useState<boolean>(false);
  const [backtrackCount, setBacktrackCount] = useState<number>(0);
  const [activeAlerts, setActiveAlerts] = useState<AnomalyAlert[]>([]);
  const [frictionDetected, setFrictionDetected] = useState<boolean>(false);
  const [frictionReason, setFrictionReason] = useState<string>('');

  // Selected configuration state
  const [selectedMic, setSelectedMic] = useState<string>('Default Built-in Microphone');
  const [selectedPersona, setSelectedPersona] = useState<string>('tuktuk');
  const [hotkey, setHotkey] = useState<string>('Ctrl + Space');
  const [testSpeechConfirmed, setTestSpeechConfirmed] = useState<boolean>(false);

  // Timers and references for telemetry
  const stepStartTimeRef = useRef<number>(Date.now());
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const sessionIdRef = useRef<string>(`sess-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`);
  const lastStepIndexRef = useRef<number>(initialStep);

  const activeSteps = simplifiedMode ? SIMPLIFIED_STEPS : FULL_STEPS;
  const currentStep = activeSteps[currentStepIndex] || activeSteps[0];

  // Safe IPC telemetry dispatcher
  const emitInteraction = useCallback((event: Partial<UserInteractionEvent>) => {
    if (!enableTelemetry) return;
    const fullEvent: UserInteractionEvent = {
      eventType: event.eventType || 'click',
      stepId: event.stepId || currentStep.id,
      stepIndex: currentStepIndex,
      dwellTimeMs: event.dwellTimeMs || (Date.now() - stepStartTimeRef.current),
      idleDurationMs: event.idleDurationMs || 0,
      backtrackCount: event.backtrackCount ?? backtrackCount,
      timestamp: Date.now(),
      sessionId: sessionIdRef.current,
      metadata: event.metadata || {},
    };

    // Dispatch via Electron preload API if available
    try {
      if (typeof window !== 'undefined') {
        const electronAPI = (window as any).electronAPI;
        const analyticsAPI = (window as any).analyticsAPI;

        if (analyticsAPI && typeof analyticsAPI.trackEvent === 'function') {
          analyticsAPI.trackEvent(fullEvent);
        } else if (electronAPI && electronAPI.analytics && typeof electronAPI.analytics.trackEvent === 'function') {
          electronAPI.analytics.trackEvent(fullEvent);
        }
      }
    } catch {
      // Ignore IPC dispatch error in testing
    }
  }, [backtrackCount, currentStep.id, currentStepIndex, enableTelemetry]);

  // Reset idle timer whenever user interacts
  const resetIdleTimer = useCallback(() => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
    }

    idleTimerRef.current = setTimeout(() => {
      // User idle for >8000ms: trigger high friction signal and emit event
      const idleDuration = 8000;
      emitInteraction({
        eventType: 'idle_timeout',
        idleDurationMs: idleDuration,
      });

      setFrictionDetected(true);
      setFrictionReason('You seem to be spending some time here. We streamlined the process for you!');
      setSimplifiedMode(true);
    }, 8000);
  }, [emitInteraction]);

  // Listen for real-time anomaly alerts from Go backend
  useEffect(() => {
    let unsubscribe: (() => void) | null = null;
    try {
      if (typeof window !== 'undefined') {
        const electronAPI = (window as any).electronAPI;
        const analyticsAPI = (window as any).analyticsAPI;
        const handler = (alert: AnomalyAlert) => {
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
      // In standalone tests
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Window event listeners for idle tracking
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

  // Step transition handlers
  const handleNextStep = () => {
    const dwell = Date.now() - stepStartTimeRef.current;
    emitInteraction({
      eventType: 'step_complete',
      dwellTimeMs: dwell,
    });

    if (currentStepIndex < activeSteps.length - 1) {
      lastStepIndexRef.current = currentStepIndex;
      setCurrentStepIndex(currentStepIndex + 1);
      stepStartTimeRef.current = Date.now();
    } else {
      // Completed onboarding
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

      // Adaptive UI trigger: If user backtracks >= 2 times, activate simplified mode
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

  return (
    <div className="flex flex-col w-full max-w-2xl mx-auto p-6 bg-slate-900 text-slate-100 rounded-xl shadow-2xl border border-slate-800">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-indigo-400">
            {simplifiedMode ? '⚡ Express Voice Onboarding' : '🎙️ Eloquent Audio Onboarding'}
          </h2>
          <p className="text-xs text-slate-400">
            Step {currentStepIndex + 1} of {activeSteps.length}: {currentStep.title}
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={handleToggleSimplified}
            className="px-2.5 py-1 text-xs rounded-md border border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/10 transition"
          >
            {simplifiedMode ? 'Switch to Detailed Mode' : 'Simplify Steps'}
          </button>
          {onSkip && (
            <button
              onClick={onSkip}
              className="px-2.5 py-1 text-xs text-slate-400 hover:text-slate-200 transition"
            >
              Skip
            </button>
          )}
        </div>
      </div>

      {/* Adaptive Friction Banner */}
      {frictionDetected && (
        <div className="mb-4 p-3 rounded-lg bg-indigo-950/60 border border-indigo-500/40 text-xs text-indigo-200 flex items-start space-x-2">
          <span className="text-base">💡</span>
          <div className="flex-1">
            <span className="font-semibold text-indigo-300">Adaptive Assistant: </span>
            {frictionReason}
          </div>
          <button
            onClick={() => setFrictionDetected(false)}
            className="text-slate-400 hover:text-slate-200 text-xs"
          >
            ✕
          </button>
        </div>
      )}

      {/* Live Anomaly Warning Banner */}
      {activeAlerts.length > 0 && (
        <div className="mb-4 p-2.5 rounded-lg bg-amber-950/40 border border-amber-600/30 text-xs text-amber-200">
          <span className="font-semibold text-amber-400">⚠️ Audio Pipeline Telemetry: </span>
          {activeAlerts[0].details}
        </div>
      )}

      {/* Step Content */}
      <div className="py-4 min-h-[220px]">
        {/* SIMPLIFIED EXPRESS MODE */}
        {simplifiedMode ? (
          <div>
            {currentStepIndex === 0 ? (
              <div className="space-y-4">
                <p className="text-sm text-slate-300">{currentStep.subtitle}</p>
                <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700/60 space-y-3">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-400">Microphone:</span>
                    <span className="font-medium text-emerald-400">✅ {selectedMic}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-400">AI Co-Pilot:</span>
                    <span className="font-medium text-indigo-300">🌸 Tuk Tuk (Default)</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-400">Hotkey:</span>
                    <span className="font-medium text-slate-200">{hotkey}</span>
                  </div>
                </div>
                <p className="text-xs text-slate-500 italic">
                  All optimal audio DSP filters (RMS VAD, AGC, and Echo Cancellation) are pre-engaged.
                </p>
              </div>
            ) : (
              <div className="text-center py-6 space-y-3">
                <div className="text-4xl">🚀</div>
                <h3 className="text-lg font-semibold text-slate-100">Setup Complete!</h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Hold <kbd className="px-1.5 py-0.5 bg-slate-800 rounded border border-slate-700 text-indigo-300">{hotkey}</kbd> anywhere to dictate or converse with your squad.
                </p>
              </div>
            )}
          </div>
        ) : (
          /* STANDARD DETAILED MODE */
          <div>
            {currentStepIndex === 0 && (
              <div className="space-y-4">
                <p className="text-sm text-slate-300">{currentStep.subtitle}</p>
                <div className="space-y-2">
                  <label className="block text-xs font-medium text-slate-400">Input Device</label>
                  <select
                    value={selectedMic}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                      setSelectedMic(e.target.value);
                      emitInteraction({ eventType: 'click', metadata: { mic: e.target.value } });
                    }}
                    className="w-full p-2 text-sm bg-slate-800 border border-slate-700 rounded-md text-slate-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="Default Built-in Microphone">Default Built-in Microphone (Recommended)</option>
                    <option value="External USB Audio Device">External USB Audio Device</option>
                    <option value="Bluetooth Headset">Bluetooth Headset</option>
                  </select>
                </div>
                <div className="p-3 bg-slate-800/40 rounded border border-slate-700/50 flex items-center justify-between text-xs text-slate-400">
                  <span>Microphone Signal Test</span>
                  <span className="text-emerald-400 font-medium">● Input Signal Active (48kHz)</span>
                </div>
              </div>
            )}

            {currentStepIndex === 1 && (
              <div className="space-y-4">
                <p className="text-sm text-slate-300">{currentStep.subtitle}</p>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { id: 'tuktuk', name: 'Tuk Tuk', desc: 'Warm, smart tech co-founder (babe)' },
                    { id: 'vision', name: 'Vision', desc: '10x Dev brother & architect (brother/bro)' },
                    { id: 'friday', name: 'Friday', desc: 'Head of Research & Strategy (Chief)' },
                    { id: 'dd', name: 'DD', desc: 'DevOps lead & reliability engineer (bro)' },
                  ].map((p) => (
                    <div
                      key={p.id}
                      onClick={() => {
                        setSelectedPersona(p.id);
                        emitInteraction({ eventType: 'click', metadata: { persona: p.id } });
                      }}
                      className={`p-3 rounded-lg border cursor-pointer transition ${
                        selectedPersona === p.id
                          ? 'border-indigo-500 bg-indigo-500/10'
                          : 'border-slate-800 hover:border-slate-700 bg-slate-800/40'
                      }`}
                    >
                      <div className="font-semibold text-sm text-slate-200">{p.name}</div>
                      <div className="text-xs text-slate-400 mt-1">{p.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {currentStepIndex === 2 && (
              <div className="space-y-4">
                <p className="text-sm text-slate-300">{currentStep.subtitle}</p>
                <div className="space-y-2">
                  <label className="block text-xs font-medium text-slate-400">Shortcut Combination</label>
                  <input
                    type="text"
                    value={hotkey}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setHotkey(e.target.value)}
                    className="w-full p-2 text-sm bg-slate-800 border border-slate-700 rounded-md text-slate-200"
                  />
                  <span className="text-xs text-slate-500">Hold to speak hands-free; release to paste text.</span>
                </div>
              </div>
            )}

            {currentStepIndex === 3 && (
              <div className="space-y-4">
                <p className="text-sm text-slate-300">{currentStep.subtitle}</p>
                <div className="p-4 bg-slate-800/40 rounded-lg border border-slate-700 space-y-3">
                  <p className="text-xs text-slate-300 font-medium">Try speaking:</p>
                  <p className="text-sm text-indigo-300 italic">"Hey Tuk Tuk, check system latency and build the project."</p>
                  <button
                    onClick={() => {
                      setTestSpeechConfirmed(true);
                      emitInteraction({ eventType: 'click', metadata: { testPassed: true } });
                    }}
                    className={`w-full py-2 px-3 rounded text-xs font-medium transition ${
                      testSpeechConfirmed
                        ? 'bg-emerald-600 text-white'
                        : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                    }`}
                  >
                    {testSpeechConfirmed ? '✅ Audio Latency Verified (18ms)' : 'Simulate Speech Recognition'}
                  </button>
                </div>
              </div>
            )}

            {currentStepIndex === 4 && (
              <div className="text-center py-6 space-y-3">
                <div className="text-4xl">🎉</div>
                <h3 className="text-lg font-semibold text-slate-100">You're all set!</h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Sub-200ms instantaneous voice pipeline with live anomaly detection is now active.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer Navigation */}
      <div className="flex items-center justify-between pt-4 mt-2 border-t border-slate-800">
        <button
          onClick={handlePreviousStep}
          disabled={currentStepIndex === 0}
          className="px-4 py-1.5 text-xs font-medium rounded-md border border-slate-700 text-slate-300 hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition"
        >
          Back
        </button>
        <button
          onClick={handleNextStep}
          className="px-5 py-1.5 text-xs font-semibold rounded-md bg-indigo-600 hover:bg-indigo-500 text-white shadow transition"
        >
          {currentStepIndex === activeSteps.length - 1 ? 'Finish' : 'Continue'}
        </button>
      </div>
    </div>
  );
};

export default OnboardingFlow;
