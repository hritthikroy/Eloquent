/**
 * src/shared/types/execution.ts
 *
 * Interfaces and Type Definitions for the Antigravity Execution Engine
 * in Eloquent Electron.
 */

export type ExecutionOperationType = 'file_write' | 'file_read' | 'system_info' | 'audio_cue' | 'process_run';

export type ExecutionStatus = 'IDLE' | 'PENDING' | 'EXECUTING' | 'COMPLETED' | 'FAILED' | 'ABORTED';

export interface ExecutionStep {
  id: string;
  operation: ExecutionOperationType;
  description: string;
  command?: string;
  args?: string[];
  targetPath?: string;
  content?: string;
  reversible?: boolean;
  status: ExecutionStatus;
  output?: string;
  error?: string;
  timestamp?: number;
}

export interface ExecutionPlan {
  id: string;
  intent: string;
  steps: ExecutionStep[];
  status: ExecutionStatus;
  createdAt: number;
  completedAt?: number;
  currentStepIndex: number;
  metadata?: Record<string, any>;
}

export interface ExecutionResult {
  success: boolean;
  planId: string;
  completedSteps: number;
  totalSteps: number;
  output?: string;
  error?: string;
  logs: string[];
}

export interface ExecutionStatusPayload {
  planId: string;
  status: ExecutionStatus;
  currentStepIndex: number;
  totalSteps: number;
  logs: string[];
  stepDetails?: ExecutionStep;
  timestamp: number;
}
