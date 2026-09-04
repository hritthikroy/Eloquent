/**
 * ChatInterface Component
 * 
 * Implements high-frequency conversational state rendering with:
 * 1. Real-time subscription to stateSyncStatus (50ms Go audio backend checkpoints)
 * 2. Visual synchronization lag indicator (synchronized, lagging, stale, paused, reconciling)
 * 3. Batched DOM updates via requestAnimationFrame to prevent flickering during rapid state updates
 * 4. Deep semantic discontinuity detection and integrity audit diff viewer
 * 5. Safe non-blocking reconciliation trigger
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  ConversationalState,
  TurnContext,
  StateSyncStatus,
  StateAuditReport,
  SemanticDiscontinuity,
  StateChangeEvent,
  RateLimitWarning,
  conversationController
} from '../conversation';

export interface ChatInterfaceProps {
  className?: string;
  style?: React.CSSProperties;
  enableAutoScroll?: boolean;
  onTurnSent?: (turn: TurnContext) => void;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
  className = '',
  style = {},
  enableAutoScroll = true,
  onTurnSent
}) => {
  // Conversational State & Turns
  const [dialogueState, setDialogueState] = useState<ConversationalState>({
    turnId: 'initial',
    participants: ['user', 'Tuk Tuk'],
    lastMessageTimestamp: Date.now(),
    contextBuffer: [
      {
        speaker: 'Tuk Tuk',
        text: 'Voice synchronization engine initialized. Ready for speech interaction.',
        timestamp: Date.now()
      }
    ],
    rateLimitInfo: {
      requestsRemaining: 60,
      resetTimestamp: Date.now() + 60000,
      isThrottled: false
    },
    currentPhase: 'idle',
    activeSpeaker: 'user',
    audioStreamState: 'inactive',
    turnSequence: 0
  });

  // Real-time Sync Status from Go Audio Backend
  const [syncStatus, setSyncStatus] = useState<StateSyncStatus>({
    status: 'synchronized',
    syncLagMs: 0,
    lastCheckpointTimestamp: Date.now(),
    lastReconciledTimestamp: Date.now(),
    gapDetected: false,
    sequenceNumber: 0,
    cpuLoad: 0.05
  });

  // State Audit & Discontinuity Report
  const [auditReport, setAuditReport] = useState<StateAuditReport | null>(null);
  const [isAuditing, setIsAuditing] = useState<boolean>(false);
  const [showAuditPanel, setShowAuditPanel] = useState<boolean>(false);
  const [inputText, setInputText] = useState<string>('');

  // Rate-Limit & Turn Race Prevention
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [rateLimitCountdown, setRateLimitCountdown] = useState<number>(0);

  // Refs for DOM Update Batching (preventing flicker on 50ms sync ticks)
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const pendingDialogueRef = useRef<ConversationalState | null>(null);
  const pendingSyncRef = useRef<StateSyncStatus | null>(null);
  const rafPendingRef = useRef<boolean>(false);
  const lastRenderedTurnCountRef = useRef<number>(dialogueState.contextBuffer.length);

  /**
   * Batched DOM update scheduler using requestAnimationFrame.
   * Flushes queued conversational states and sync updates in a single animation frame,
   * completely eliminating UI flicker and layout thrashing during high-frequency ticks.
   */
  const scheduleBatchedUpdate = useCallback(() => {
    if (rafPendingRef.current) return;
    rafPendingRef.current = true;

    requestAnimationFrame(() => {
      rafPendingRef.current = false;

      // Batch sync status update
      if (pendingSyncRef.current) {
        setSyncStatus(pendingSyncRef.current);
        pendingSyncRef.current = null;
      }

      // Batch dialogue turns update only if turns changed or last timestamp updated
      if (pendingDialogueRef.current) {
        const next = pendingDialogueRef.current;
        pendingDialogueRef.current = null;
        setDialogueState(next);

        if (enableAutoScroll && next.contextBuffer.length !== lastRenderedTurnCountRef.current) {
          lastRenderedTurnCountRef.current = next.contextBuffer.length;
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
      }
    });
  }, [enableAutoScroll]);

  /**
   * Subscribe to stateSyncStatus and conversational state updates
   */
  useEffect(() => {
    // 1. Initial sync from controller
    conversationController.init().then(initialState => {
      if (initialState && initialState.contextBuffer?.length > 0) {
        pendingDialogueRef.current = initialState;
        scheduleBatchedUpdate();
      }
    });

    // 2. Subscribe to high-frequency stateSyncStatus events from audio backend
    const unsubscribeSync = conversationController.subscribeSyncStatus((status: StateSyncStatus) => {
      pendingSyncRef.current = status;
      scheduleBatchedUpdate();
    });

    // 3. Subscribe to conversational state updates
    const unsubscribeState = conversationController.subscribe((state: ConversationalState) => {
      pendingDialogueRef.current = state;
      scheduleBatchedUpdate();
    });

    // 4. Subscribe to live turn indicators
    const unsubscribeTurn = conversationController.subscribeTurnIndicator((evt: StateChangeEvent) => {
      setDialogueState(prev => ({
        ...prev,
        currentPhase: evt.newPhase,
        activeSpeaker: evt.speaker,
        audioStreamState: evt.audioState,
        turnSequence: evt.turnSeq
      }));
    });

    // 5. Subscribe to phase transitions
    const unsubscribePhase = conversationController.subscribePhaseChanged((evt: StateChangeEvent) => {
      setDialogueState(prev => ({
        ...prev,
        currentPhase: evt.newPhase,
        activeSpeaker: evt.speaker
      }));
    });

    // 6. Subscribe to rate limit backoff warnings
    const unsubscribeRateLimit = conversationController.subscribeRateLimitWarning((warning: RateLimitWarning) => {
      setDialogueState(prev => ({
        ...prev,
        rateLimitInfo: {
          ...prev.rateLimitInfo,
          isThrottled: warning.isThrottled,
          backoffMs: warning.backoffMs,
          resetTimestamp: warning.resetTimestamp
        }
      }));
    });

    return () => {
      unsubscribeSync();
      unsubscribeState();
      unsubscribeTurn();
      unsubscribePhase();
      unsubscribeRateLimit();
    };
  }, [scheduleBatchedUpdate]);

  // Rate-Limit Countdown Timer
  useEffect(() => {
    if (!dialogueState.rateLimitInfo?.isThrottled) {
      setRateLimitCountdown(0);
      return;
    }

    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((dialogueState.rateLimitInfo.resetTimestamp - Date.now()) / 1000));
      setRateLimitCountdown(remaining);
      if (remaining <= 0) {
        setDialogueState(prev => ({
          ...prev,
          rateLimitInfo: { ...prev.rateLimitInfo, isThrottled: false, backoffMs: 0 }
        }));
      }
    }, 200);

    return () => clearInterval(interval);
  }, [dialogueState.rateLimitInfo?.isThrottled, dialogueState.rateLimitInfo?.resetTimestamp]);

  /**
   * Sends a user turn through the conversation controller with optimistic turn locking
   */
  const handleSendMessage = useCallback(async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = inputText.trim();
    if (!text || isSubmitting || dialogueState.rateLimitInfo?.isThrottled) return;

    setIsSubmitting(true);
    setInputText('');

    const newTurn: TurnContext = {
      speaker: 'user',
      text,
      timestamp: Date.now()
    };

    if (onTurnSent) onTurnSent(newTurn);

    try {
      await conversationController.appendTurn(newTurn);
    } catch (err) {
      console.error('Failed to append turn:', err);
    } finally {
      setIsSubmitting(false);
    }
  }, [inputText, isSubmitting, dialogueState.rateLimitInfo?.isThrottled, onTurnSent]);

  /**
   * Invokes conversation:verify-integrity to audit semantic continuity
   */
  const handleVerifyIntegrity = useCallback(async () => {
    setIsAuditing(true);
    try {
      const report = await conversationController.verifyIntegrity();
      if (report) {
        setAuditReport(report);
        setShowAuditPanel(true);
      }
    } catch (err) {
      console.error('Integrity verification failed:', err);
    } finally {
      setIsAuditing(false);
    }
  }, []);

  /**
   * Triggers non-blocking state reconciliation to patch detected gaps
   */
  const handleReconcileNow = useCallback(async () => {
    setIsAuditing(true);
    try {
      const report = await conversationController.reconcileState();
      if (report) {
        setAuditReport(report);
        setShowAuditPanel(true);
      }
    } catch (err) {
      console.error('State reconciliation failed:', err);
    } finally {
      setIsAuditing(false);
    }
  }, []);

  // Compute visual badge colors and status text based on syncLagMs and status
  const statusBadgeConfig = useMemo(() => {
    switch (syncStatus.status) {
      case 'synchronized':
        return {
          bg: '#064e3b',
          border: '#059669',
          color: '#34d399',
          label: 'SYNCED',
          icon: '🟢'
        };
      case 'lagging':
        return {
          bg: '#78350f',
          border: '#d97706',
          color: '#fbbf24',
          label: 'LAGGING',
          icon: '🟡'
        };
      case 'stale':
        return {
          bg: '#7f1d1d',
          border: '#dc2626',
          color: '#f87171',
          label: 'STALE DRIFT',
          icon: '🔴'
        };
      case 'reconciling':
        return {
          bg: '#164e63',
          border: '#0891b2',
          color: '#38bdf8',
          label: 'RECONCILING',
          icon: '🔄'
        };
      case 'paused':
      default:
        return {
          bg: '#1e293b',
          border: '#475569',
          color: '#94a3b8',
          label: 'PAUSED',
          icon: '⏸️'
        };
    }
  }, [syncStatus.status]);

  // Compute turn-taking phase badge colors, icon, and persona aura
  const phaseConfig = useMemo(() => {
    const phase = dialogueState.currentPhase || 'idle';
    switch (phase) {
      case 'listening':
        return {
          bg: '#064e3b',
          border: '#059669',
          color: '#34d399',
          label: 'LISTENING',
          icon: '🎙️',
          aura: '0 0 14px rgba(52, 211, 153, 0.45)'
        };
      case 'thinking':
        return {
          bg: '#78350f',
          border: '#d97706',
          color: '#fbbf24',
          label: 'THINKING',
          icon: '🧠',
          aura: '0 0 14px rgba(251, 191, 36, 0.45)'
        };
      case 'speaking':
        return {
          bg: '#4c1d95',
          border: '#7c3aed',
          color: '#c084fc',
          label: `SPEAKING [${dialogueState.activeSpeaker || 'Agent'}]`,
          icon: '🗣️',
          aura: '0 0 16px rgba(192, 132, 252, 0.55)'
        };
      case 'error':
        return {
          bg: '#7f1d1d',
          border: '#dc2626',
          color: '#f87171',
          label: 'ERROR',
          icon: '⚠️',
          aura: '0 0 14px rgba(248, 113, 113, 0.45)'
        };
      case 'rehydrating':
        return {
          bg: '#164e63',
          border: '#0891b2',
          color: '#38bdf8',
          label: 'REHYDRATING',
          icon: '🔄',
          aura: '0 0 14px rgba(56, 189, 248, 0.45)'
        };
      case 'idle':
      default:
        return {
          bg: '#1e293b',
          border: '#334155',
          color: '#94a3b8',
          label: 'IDLE',
          icon: '🟢',
          aura: 'none'
        };
    }
  }, [dialogueState.currentPhase, dialogueState.activeSpeaker]);

  return (
    <div
      className={`chat-interface-container ${className}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        backgroundColor: '#0b0f19',
        color: '#f1f5f9',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        overflow: 'hidden',
        boxSizing: 'border-box',
        ...style
      }}
    >
      {/* Header with Real-Time Sync Status Indicator */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 18px',
          borderBottom: '1px solid #1e293b',
          backgroundColor: '#0f172a'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '18px' }}>🎙️</span>
          <div>
            <h2 style={{ fontSize: '15px', fontWeight: 600, margin: 0, color: '#f8fafc' }}>
              Eloquent Conversational State
            </h2>
            <div style={{ fontSize: '11px', color: '#64748b' }}>
              Turn ID: {dialogueState.turnId} • Seq #{dialogueState.turnSequence || syncStatus.sequenceNumber}
            </div>
          </div>
        </div>

        {/* Sync Lag & Backend Metrics Bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Turn-Taking Phase & Active Speaker Aura Indicator */}
          <div
            title={`Conversation phase: ${phaseConfig.label} | Floor holder: ${dialogueState.activeSpeaker || 'user'}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: '20px',
              backgroundColor: phaseConfig.bg,
              border: `1px solid ${phaseConfig.border}`,
              color: phaseConfig.color,
              fontSize: '12px',
              fontWeight: 600,
              boxShadow: phaseConfig.aura,
              transition: 'all 0.2s ease-in-out'
            }}
          >
            <span>{phaseConfig.icon}</span>
            <span>{phaseConfig.label}</span>
          </div>

          {/* Visual Sync Lag Indicator Badge */}
          <div
            title={`Audio backend sync lag: ${syncStatus.syncLagMs}ms | CPU: ${Math.round(syncStatus.cpuLoad * 100)}%`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: '20px',
              backgroundColor: statusBadgeConfig.bg,
              border: `1px solid ${statusBadgeConfig.border}`,
              color: statusBadgeConfig.color,
              fontSize: '12px',
              fontWeight: 600,
              boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
            }}
          >
            <span>{statusBadgeConfig.icon}</span>
            <span>{statusBadgeConfig.label}</span>
            <span style={{ opacity: 0.8, fontSize: '11px', marginLeft: '2px' }}>
              ({syncStatus.syncLagMs}ms)
            </span>
          </div>

          {/* Gap Alert / Quick Reconcile Button */}
          {syncStatus.gapDetected && (
            <button
              onClick={handleReconcileNow}
              disabled={isAuditing}
              style={{
                backgroundColor: '#dc2626',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                padding: '4px 10px',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                animation: 'pulse 1.5s infinite'
              }}
            >
              ⚠️ Patch Gap
            </button>
          )}

          {/* Integrity Verification Action */}
          <button
            onClick={handleVerifyIntegrity}
            disabled={isAuditing}
            style={{
              backgroundColor: '#1e293b',
              color: '#cbd5e1',
              border: '1px solid #334155',
              borderRadius: '6px',
              padding: '5px 12px',
              fontSize: '12px',
              fontWeight: 500,
              cursor: isAuditing ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'background-color 0.15s'
            }}
          >
            <span>🔍</span>
            <span>{isAuditing ? 'Auditing...' : 'Verify Integrity'}</span>
          </button>
        </div>
      </header>

      {/* Real-Time API Rate-Limit Mitigation Banner */}
      {dialogueState.rateLimitInfo?.isThrottled && (
        <div
          style={{
            backgroundColor: '#450a0a',
            borderBottom: '1px solid #b91c1c',
            padding: '8px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            color: '#fca5a5',
            fontSize: '12px',
            fontWeight: 500,
            zIndex: 10
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '16px' }}>⏳</span>
            <span>
              <strong>API Rate Limit Backoff Active:</strong> Re-enabling in {rateLimitCountdown}s. Turns are serialized & queued without loss.
            </span>
          </div>
          <button
            onClick={() => conversationController.resetRateLimit()}
            style={{
              backgroundColor: '#7f1d1d',
              color: '#fee2e2',
              border: '1px solid #ef4444',
              borderRadius: '4px',
              padding: '3px 9px',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Reset Throttle Lock
          </button>
        </div>
      )}

      {/* Semantic Discontinuity / Audit Report Drawer */}
      {showAuditPanel && auditReport && (
        <div
          style={{
            backgroundColor: '#111827',
            borderBottom: '1px solid #374151',
            padding: '12px 18px',
            fontSize: '12px',
            maxHeight: '180px',
            overflowY: 'auto'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontWeight: 600, color: auditReport.isValid ? '#34d399' : '#f87171' }}>
                {auditReport.isValid ? '✅ State Integrity Validated' : '⚠️ Semantic Discontinuities Detected'}
              </span>
              <span style={{ color: '#9ca3af' }}>
                ({auditReport.detectedGapsCount} gap{auditReport.detectedGapsCount === 1 ? '' : 's'}, {auditReport.patchedTurnsCount} patched)
              </span>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              {!auditReport.isValid && (
                <button
                  onClick={handleReconcileNow}
                  style={{
                    backgroundColor: '#2563eb',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '3px 8px',
                    fontSize: '11px',
                    cursor: 'pointer'
                  }}
                >
                  Reconcile Now
                </button>
              )}
              <button
                onClick={() => setShowAuditPanel(false)}
                style={{
                  backgroundColor: 'transparent',
                  color: '#9ca3af',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                ✕
              </button>
            </div>
          </div>

          {auditReport.discontinuities.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {auditReport.discontinuities.map((gap: SemanticDiscontinuity) => (
                <div
                  key={gap.id}
                  style={{
                    backgroundColor: '#1f2937',
                    padding: '6px 10px',
                    borderRadius: '4px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <div>
                    <span style={{ color: '#f59e0b', fontWeight: 600, marginRight: '6px' }}>
                      [{gap.gapType}]
                    </span>
                    <span style={{ color: '#d1d5db' }}>{gap.patchDescription}</span>
                  </div>
                  <span
                    style={{
                      color: gap.patchApplied ? '#34d399' : '#ef4444',
                      fontSize: '11px',
                      fontWeight: 500
                    }}
                  >
                    {gap.patchApplied ? '✓ Patched' : 'Pending'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color: '#9ca3af', fontStyle: 'italic' }}>
              Zero semantic drift detected between Electron UI dialogue history and Go audio backend buffer.
            </div>
          )}
        </div>
      )}

      {/* Batched Conversation Turns Rendering Loop */}
      <main
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}
      >
        {dialogueState.contextBuffer.map((turn, index) => {
          const isUser = turn.speaker.toLowerCase() === 'user';
          return (
            <div
              key={`${turn.timestamp || index}-${index}`}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: isUser ? 'flex-end' : 'flex-start',
                width: '100%'
              }}
            >
              <div
                style={{
                  fontSize: '11px',
                  color: '#64748b',
                  marginBottom: '3px',
                  marginLeft: isUser ? '0' : '4px',
                  marginRight: isUser ? '4px' : '0'
                }}
              >
                {turn.speaker} • {new Date(turn.timestamp || Date.now()).toLocaleTimeString()}
              </div>
              <div
                style={{
                  maxWidth: '75%',
                  padding: '10px 14px',
                  borderRadius: isUser ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                  backgroundColor: isUser ? '#2563eb' : '#1e293b',
                  color: '#f8fafc',
                  fontSize: '13px',
                  lineHeight: '1.45',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
                  wordBreak: 'break-word'
                }}
              >
                {turn.text}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </main>

      {/* Message Input & Interaction Footer */}
      <footer
        style={{
          padding: '12px 18px',
          borderTop: '1px solid #1e293b',
          backgroundColor: '#0f172a'
        }}
      >
        <form
          onSubmit={handleSendMessage}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}
        >
          <input
            type="text"
            value={inputText}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInputText(e.target.value)}
            placeholder="Type a conversational turn or speak into microphone..."
            style={{
              flex: 1,
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '8px',
              padding: '9px 14px',
              color: '#f8fafc',
              fontSize: '13px',
              outline: 'none'
            }}
          />
          <button
            type="submit"
            disabled={!inputText.trim() || isSubmitting || dialogueState.rateLimitInfo?.isThrottled}
            style={{
              backgroundColor: dialogueState.rateLimitInfo?.isThrottled ? '#7f1d1d' : '#2563eb',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              padding: '9px 18px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: (!inputText.trim() || isSubmitting || dialogueState.rateLimitInfo?.isThrottled) ? 'not-allowed' : 'pointer',
              opacity: (!inputText.trim() || isSubmitting || dialogueState.rateLimitInfo?.isThrottled) ? 0.6 : 1,
              transition: 'all 0.15s'
            }}
          >
            {isSubmitting ? 'Sending...' : dialogueState.rateLimitInfo?.isThrottled ? `Throttled (${rateLimitCountdown}s)` : 'Send Turn'}
          </button>
        </form>
      </footer>
    </div>
  );
};

export default ChatInterface;
