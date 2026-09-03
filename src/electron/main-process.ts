/**
 * Electron Main Process Prompt Bridge
 * Routes raw user input through the PromptEngineer self-correction engine
 * to guarantee that downstream LLM, Antigravity, or Go audio backend interfaces
 * receive an authoritative, structured "real prompt" adhering to the 3-section format.
 */

import { PromptEngineer } from '../core/prompt-engineer';
import { PromptAstValidator } from '../utils/ast-validator';
import { StructuredMetaPrompt } from '../types/prompt-schema';
import { WorkspaceContext } from '../prompts/gap-resolver';
import { spawn } from 'child_process';

export class MainProcessPromptBridge {
  /**
   * Route raw user speech or input through PromptEngineer to produce an authoritative prompt
   */
  public static async routeUserInput(
    rawInput: string,
    context?: WorkspaceContext
  ): Promise<StructuredMetaPrompt> {
    console.log(`🧭 [MainProcessPromptBridge] Routing input through PromptEngineer self-correction loop...`);
    
    // 1. Generate structured prompt
    const structuredPrompt = await PromptEngineer.generateMetaPrompt(rawInput, context);

    // 2. Ensure prompt is copied to clipboard for direct Antigravity ingestion
    if (process.platform === 'darwin') {
      try {
        const cp = spawn('pbcopy');
        cp.stdin.write(structuredPrompt.rawText);
        cp.stdin.end();
        console.log(`📋 [MainProcessPromptBridge] Copied 3-section prompt to clipboard (${structuredPrompt.rawText.length} chars)`);
      } catch (err: any) {
        console.warn(`⚠️ [MainProcessPromptBridge] pbcopy warning:`, err.message);
      }
    }

    return structuredPrompt;
  }

  /**
   * Register IPC handlers with Electron main process
   */
  public static registerIpcHandlers(ipcMain: any): void {
    if (!ipcMain || typeof ipcMain.handle !== 'function') return;

    ipcMain.handle('prompt-engineer:generate', async (_event: any, payload: { rawInput: string; context?: WorkspaceContext }) => {
      try {
        const result = await this.routeUserInput(payload.rawInput, payload.context);
        return { success: true, prompt: result };
      } catch (error: any) {
        console.error(`❌ [MainProcessPromptBridge] Error generating meta-prompt:`, error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('prompt-engineer:validate', async (_event: any, payload: { promptText: string }) => {
      try {
        const validation = PromptAstValidator.validate(payload.promptText);
        return { success: true, validation };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    });
  }
}
