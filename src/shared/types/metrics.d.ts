/**
 * Unified Analytics & Anomaly Detection Metric Interfaces
 * 
 * Strict type contracts bridging the Electron main/renderer processes
 * and the Go audio backend over WebSocket/IPC channels.
 */

export type UserInteractionEventType =
  | 'click'
  | 'dwell'
  | 'step_start'
  | 'step_complete'
  | 'backtrack'
  | 'idle_timeout'
  | 'input'
  | 'error'
  | 'toggle_simplified_mode';

export interface UserInteractionEvent {
  eventType: UserInteractionEventType;
  stepId: string;
  stepIndex?: number;
  elementId?: string;
  dwellTimeMs?: number;
  idleDurationMs?: number;
  backtrackCount?: number;
  timestamp: number;
  sessionId: string;
  userId?: string;
  metadata?: Record<string, unknown>;
}

export interface AudioLatencySample {
  streamId: string;
  frameId: number | string;
  captureLatencyMs: number;
  vadLatencyMs: number;
  processingLatencyMs: number;
  totalLatencyMs: number;
  bufferUnderruns?: number;
  bufferOverruns?: number;
  sampleRate?: number;
  timestamp: number;
}

export type AnomalySeverity = 'low' | 'medium' | 'high' | 'critical';

export type AnomalyType =
  | 'audio_latency_spike'
  | 'user_friction_high'
  | 'high_drop_off_rate'
  | 'excessive_backtracking'
  | 'buffer_underrun_surge';

export interface AnomalyAlert {
  id: string;
  alertType: AnomalyType;
  severity: AnomalySeverity;
  metricName: string;
  currentValue: number;
  thresholdValue: number;
  slidingWindowSize: number;
  windowMean?: number;
  windowStdDev?: number;
  zScore?: number;
  timestamp: number;
  details: string;
  suggestedAction?: string;
  metadata?: Record<string, unknown>;
}

export interface SlidingWindowStats {
  count: number;
  mean: number;
  variance: number;
  stdDev: number;
  p95: number;
  min: number;
  max: number;
  sampleSize: number;
}

export interface AnalyticsBridgeConfig {
  wsUrl?: string;
  host?: string;
  port?: number;
  batchSize?: number;
  flushIntervalMs?: number;
  maxQueueCapacity?: number;
  reconnectInitialDelayMs?: number;
  reconnectMaxDelayMs?: number;
  reconnectMultiplier?: number;
}

export interface OnboardingUXMetrics {
  currentStep: number;
  totalSteps: number;
  dwellTimeMs: number;
  idleDurationMs: number;
  backtrackCount: number;
  isHighFriction: boolean;
  simplifiedModeActive: boolean;
  completionPercentage: number;
  recentAlerts: AnomalyAlert[];
}

export type AnalyticsWebSocketMessageType =
  | 'interaction_batch'
  | 'latency_sample'
  | 'anomaly_alert'
  | 'window_stats_request'
  | 'window_stats_response'
  | 'heartbeat'
  | 'ack';

export interface AnalyticsWebSocketMessage {
  type: AnalyticsWebSocketMessageType;
  payload: unknown;
  timestamp: number;
  messageId?: string;
}

export interface UXMetricsValidationReport {
  timestamp: number;
  onboardingCompletionRate: number;
  targetCompletionRate: number;
  p95AudioLatencyMs: number;
  maxAllowedLatencyMs: number;
  anomalyDetectionF1Score: number;
  totalSessionsEvaluated: number;
  totalLatencySamplesEvaluated: number;
  anomaliesDetectedCount: number;
  passed: boolean;
  failureReasons: string[];
}
