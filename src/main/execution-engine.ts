/**
 * src/main/execution-engine.ts
 *
 * Antigravity Execution Engine
 * Bridges the Electron main process with system/Node operations and Go backend calls,
 * providing safe, whitelisted, sandboxed, and abortable command execution.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execFile, ChildProcess } from 'child_process';
import {
  ExecutionPlan,
  ExecutionStep,
  ExecutionResult,
  ExecutionStatusPayload,
  ExecutionOperationType,
  ExecutionStatus
} from '../shared/types/execution';
import { audioManager } from './audio-manager';

export class ExecutionEngine {
  private static instance: ExecutionEngine;
  private activePlans: Map<string, ExecutionPlan> = new Map();
  private planLogs: Map<string, string[]> = new Map();
  private runningProcesses: Map<string, ChildProcess> = new Map();
  private abortFlags: Map<string, boolean> = new Map();

  // Whitelisted operations and executable binaries for security
  private readonly ALLOWED_OPERATIONS: Set<ExecutionOperationType> = new Set([
    'file_write',
    'file_read',
    'system_info',
    'audio_cue',
    'process_run'
  ]);

  private readonly ALLOWED_COMMANDS: Set<string> = new Set([
    'git',
    'node',
    'npm',
    'echo',
    'ls',
    'go',
    'pwd',
    'whoami',
    'date'
  ]);

  private constructor() {}

  public static getInstance(): ExecutionEngine {
    if (!ExecutionEngine.instance) {
      ExecutionEngine.instance = new ExecutionEngine();
    }
    return ExecutionEngine.instance;
  }

  /**
   * Parses a natural language intent or structured payload into a validated ExecutionPlan.
   */
  public parseIntent(intent: string | Record<string, any>): ExecutionPlan {
    const planId = `plan_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const steps: ExecutionStep[] = [];

    if (typeof intent === 'object' && intent !== null && Array.isArray(intent.steps)) {
      // Structured intent format
      intent.steps.forEach((rawStep: any, idx: number) => {
        const op: ExecutionOperationType = rawStep.operation || 'system_info';
        if (!this.ALLOWED_OPERATIONS.has(op)) {
          throw new Error(`Operation '${op}' is not in the security whitelist.`);
        }

        if (op === 'process_run' && rawStep.command) {
          const cmdBase = path.basename(rawStep.command.trim().split(' ')[0]);
          if (!this.ALLOWED_COMMANDS.has(cmdBase)) {
            throw new Error(`Command '${cmdBase}' is not permitted for execution.`);
          }
        }

        steps.push({
          id: `step_${idx + 1}`,
          operation: op,
          description: rawStep.description || `Execute ${op}`,
          command: rawStep.command,
          args: Array.isArray(rawStep.args) ? rawStep.args : [],
          targetPath: rawStep.targetPath,
          content: rawStep.content,
          reversible: !!rawStep.reversible,
          status: 'PENDING'
        });
      });
    } else {
      // Natural language / String parsing
      const intentStr = typeof intent === 'string' ? intent.trim() : JSON.stringify(intent);

      if (intentStr.toLowerCase().includes('system') || intentStr.toLowerCase().includes('info')) {
        steps.push({
          id: 'step_1',
          operation: 'system_info',
          description: 'Gather system specifications and status',
          status: 'PENDING'
        });
      } else if (intentStr.toLowerCase().includes('write file') || intentStr.toLowerCase().includes('create file')) {
        const parts = intentStr.split(' ');
        const targetPath = parts[2] || 'output.txt';
        const content = intentStr.substring(intentStr.indexOf(targetPath) + targetPath.length).trim() || 'Default content';

        steps.push({
          id: 'step_1',
          operation: 'file_write',
          description: `Write data to ${targetPath}`,
          targetPath,
          content,
          reversible: true,
          status: 'PENDING'
        });
      } else if (intentStr.toLowerCase().includes('read file')) {
        const targetPath = intentStr.split(' ').pop() || 'output.txt';
        steps.push({
          id: 'step_1',
          operation: 'file_read',
          description: `Read contents from ${targetPath}`,
          targetPath,
          status: 'PENDING'
        });
      } else if (intentStr.toLowerCase().includes('audio') || intentStr.toLowerCase().includes('cue') || intentStr.toLowerCase().includes('chai chhi')) {
        steps.push({
          id: 'step_1',
          operation: 'audio_cue',
          description: 'Trigger voice command audio response cue',
          status: 'PENDING'
        });
      } else {
        // Default safe system info step
        steps.push({
          id: 'step_1',
          operation: 'system_info',
          description: `Process intent: ${intentStr}`,
          status: 'PENDING'
        });
      }
    }

    const plan: ExecutionPlan = {
      id: planId,
      intent: typeof intent === 'string' ? intent : JSON.stringify(intent),
      steps,
      status: 'PENDING',
      createdAt: Date.now(),
      currentStepIndex: 0
    };

    this.activePlans.set(planId, plan);
    this.planLogs.set(planId, [`[ExecutionEngine - Tuk Tuk] babe, plan ${planId} initialized with ${steps.length} steps.`]);
    this.abortFlags.set(planId, false);

    return plan;
  }

  /**
   * Executes a plan sequentially with real-time log updates and abort isolation.
   */
  public async executePlan(
    planId: string,
    onProgress?: (status: ExecutionStatusPayload) => void
  ): Promise<ExecutionResult> {
    const plan = this.activePlans.get(planId);
    if (!plan) {
      throw new Error(`Plan with ID ${planId} not found.`);
    }

    plan.status = 'EXECUTING';
    this.appendLog(planId, `[ExecutionEngine] Starting execution for plan ${planId}...`);
    this.notifyProgress(plan, onProgress);

    let completedCount = 0;

    for (let i = 0; i < plan.steps.length; i++) {
      if (this.abortFlags.get(planId)) {
        plan.status = 'ABORTED';
        this.appendLog(planId, `[ExecutionEngine - Vision] brother, execution plan ${planId} aborted by user signal.`);
        this.notifyProgress(plan, onProgress);
        return {
          success: false,
          planId,
          completedSteps: completedCount,
          totalSteps: plan.steps.length,
          error: 'Execution aborted by user',
          logs: this.planLogs.get(planId) || []
        };
      }

      plan.currentStepIndex = i;
      const step = plan.steps[i];
      step.status = 'EXECUTING';
      step.timestamp = Date.now();
      this.appendLog(planId, `[ExecutionEngine] Executing step ${i + 1}/${plan.steps.length}: ${step.description}`);
      this.notifyProgress(plan, onProgress);

      try {
        const stepOutput = await this.executeStep(planId, step);
        step.status = 'COMPLETED';
        step.output = stepOutput;
        completedCount++;
        this.appendLog(planId, `[ExecutionEngine] Step ${i + 1} completed successfully.`);
      } catch (err: any) {
        if (this.abortFlags.get(planId)) {
          plan.status = 'ABORTED';
          step.status = 'ABORTED';
          step.error = 'Execution aborted by user';
          this.appendLog(planId, `[ExecutionEngine - Vision] brother, execution plan ${planId} aborted by user signal.`);
          this.notifyProgress(plan, onProgress);
          return {
            success: false,
            planId,
            completedSteps: completedCount,
            totalSteps: plan.steps.length,
            error: 'Execution aborted by user',
            logs: this.planLogs.get(planId) || []
          };
        }

        step.status = 'FAILED';
        step.error = err.message || 'Step execution error';
        plan.status = 'FAILED';
        this.appendLog(planId, `[ExecutionEngine - Friday] Chief, error in step ${i + 1}: ${step.error}`);
        this.notifyProgress(plan, onProgress);

        return {
          success: false,
          planId,
          completedSteps: completedCount,
          totalSteps: plan.steps.length,
          error: step.error,
          logs: this.planLogs.get(planId) || []
        };
      }

      this.notifyProgress(plan, onProgress);
    }

    plan.status = 'COMPLETED';
    plan.completedAt = Date.now();
    this.appendLog(planId, `[ExecutionEngine - DD] bro, all ${completedCount} steps executed cleanly.`);
    this.notifyProgress(plan, onProgress);

    return {
      success: true,
      planId,
      completedSteps: completedCount,
      totalSteps: plan.steps.length,
      output: plan.steps[plan.steps.length - 1]?.output || 'Completed',
      logs: this.planLogs.get(planId) || []
    };
  }

  /**
   * Aborts an active execution plan.
   */
  public abortPlan(planId: string): boolean {
    const plan = this.activePlans.get(planId);
    if (!plan || plan.status === 'COMPLETED' || plan.status === 'FAILED' || plan.status === 'ABORTED') {
      return false;
    }

    this.abortFlags.set(planId, true);
    const proc = this.runningProcesses.get(planId);
    if (proc) {
      try {
        proc.kill('SIGTERM');
      } catch (e) {}
      this.runningProcesses.delete(planId);
    }

    plan.status = 'ABORTED';
    this.appendLog(planId, `[ExecutionEngine] Abort request registered for plan ${planId}.`);
    return true;
  }

  /**
   * Retrieves current status payload for a plan.
   */
  public getPlanStatus(planId: string): ExecutionStatusPayload | null {
    const plan = this.activePlans.get(planId);
    if (!plan) return null;

    return {
      planId: plan.id,
      status: plan.status,
      currentStepIndex: plan.currentStepIndex,
      totalSteps: plan.steps.length,
      logs: this.planLogs.get(planId) || [],
      stepDetails: plan.steps[plan.currentStepIndex],
      timestamp: Date.now()
    };
  }

  /**
   * Internal step execution handler.
   */
  private async executeStep(planId: string, step: ExecutionStep): Promise<string> {
    switch (step.operation) {
      case 'system_info': {
        const info = {
          platform: os.platform(),
          arch: os.arch(),
          cpus: os.cpus().length,
          totalMem: `${Math.round(os.totalmem() / (1024 * 1024))} MB`,
          freeMem: `${Math.round(os.freemem() / (1024 * 1024))} MB`,
          uptime: `${Math.round(os.uptime())} s`
        };
        return JSON.stringify(info, null, 2);
      }

      case 'file_write': {
        if (!step.targetPath) {
          throw new Error('Target path required for file_write operation');
        }
        const resolvedPath = path.resolve(process.cwd(), step.targetPath);
        // Security check: reject relative path traversal trying to escape root
        if (!resolvedPath.startsWith(process.cwd()) && !resolvedPath.startsWith(os.tmpdir())) {
          throw new Error(`Target path '${step.targetPath}' is outside authorized directory.`);
        }
        await fs.promises.mkdir(path.dirname(resolvedPath), { recursive: true });
        await fs.promises.writeFile(resolvedPath, step.content || '', 'utf8');
        return `Successfully wrote ${Buffer.byteLength(step.content || '')} bytes to ${step.targetPath}`;
      }

      case 'file_read': {
        if (!step.targetPath) {
          throw new Error('Target path required for file_read operation');
        }
        const resolvedPath = path.resolve(process.cwd(), step.targetPath);
        if (!resolvedPath.startsWith(process.cwd()) && !resolvedPath.startsWith(os.tmpdir())) {
          throw new Error(`Target path '${step.targetPath}' is outside authorized directory.`);
        }
        const data = await fs.promises.readFile(resolvedPath, 'utf8');
        return data.length > 500 ? `${data.substring(0, 500)}... [truncated]` : data;
      }

      case 'audio_cue': {
        const payload = audioManager.processCommandRecognition('chai chhi', 0.99);
        return `Audio cue triggered: state=${payload.state}, timestamp=${payload.timestamp}`;
      }

      case 'process_run': {
        const rawCmd = step.command || 'echo';
        const cmdBase = path.basename(rawCmd.trim());

        if (!this.ALLOWED_COMMANDS.has(cmdBase)) {
          throw new Error(`Command '${cmdBase}' is not in the execution whitelist.`);
        }

        const args = step.args || [];

        return new Promise<string>((resolve, reject) => {
          const proc = execFile(
            cmdBase,
            args,
            { timeout: 10000, maxBuffer: 1024 * 1024 },
            (error, stdout, stderr) => {
              this.runningProcesses.delete(planId);
              if (this.abortFlags.get(planId)) {
                return reject(new Error('Execution aborted by user'));
              }
              if (error) {
                return reject(new Error(`Command process failed: ${error.message}. Stderr: ${stderr}`));
              }
              resolve(stdout.trim() || stderr.trim() || 'Process completed with no output');
            }
          );

          this.runningProcesses.set(planId, proc);
        });
      }

      default:
        throw new Error(`Unsupported operation: ${step.operation}`);
    }
  }

  private appendLog(planId: string, logMsg: string): void {
    const logs = this.planLogs.get(planId) || [];
    logs.push(`[${new Date().toISOString()}] ${logMsg}`);
    this.planLogs.set(planId, logs);
  }

  private notifyProgress(plan: ExecutionPlan, onProgress?: (status: ExecutionStatusPayload) => void): void {
    if (!onProgress) return;

    const payload: ExecutionStatusPayload = {
      planId: plan.id,
      status: plan.status,
      currentStepIndex: plan.currentStepIndex,
      totalSteps: plan.steps.length,
      logs: this.planLogs.get(plan.id) || [],
      stepDetails: plan.steps[plan.currentStepIndex],
      timestamp: Date.now()
    };

    try {
      onProgress(payload);
    } catch (e) {}
  }
}

export const executionEngine = ExecutionEngine.getInstance();
