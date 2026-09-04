import { EventEmitter } from 'events';

export interface BondingConfig {
  w1: number;
  w2: number;
  w3: number;
  decayLambda: number;
  defaultAgents: string[];
  minTickIntervalMs: number;
  maxTickIntervalMs: number;
  defaultTickIntervalMs: number;
}

export const BONDING_CONFIG: BondingConfig;

export interface TeamBondingMetrics {
  bondingScore: number;
  averageStability: number;
  averageAffinity: number;
  syncRecencyFactor: number;
  stabilityScores: Record<string, number>;
  affinityMatrix: Record<string, Record<string, number>>;
  deltaT: number;
}

export interface AgentLoopOptions {
  tickIntervalMs?: number;
  useWorker?: boolean;
  initialState?: Record<string, any>;
}

export interface AgentLoopFullMetrics extends TeamBondingMetrics {
  tickCount: number;
  isRunning: boolean;
  useWorker: boolean;
  tickIntervalMs: number;
}

export function calculateTeamBondingMetrics(
  state?: any,
  options?: { agents?: string[] }
): TeamBondingMetrics;

export class AgentLoopManager extends EventEmitter {
  constructor(options?: AgentLoopOptions);
  tickIntervalMs: number;
  useWorker: boolean;
  isRunning: boolean;
  tickCount: number;
  start(): this;
  stop(): void;
  recordInteraction(fromAgent: string, toAgent: string, metadata?: Record<string, any>): void;
  updateAgentState(agentId: string, state: Record<string, any>): void;
  getMetrics(): AgentLoopFullMetrics;
  getBondingScore(): number;
}
