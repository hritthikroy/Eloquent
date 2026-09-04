/**
 * TypeScript Integration Bridge
 * Provides type-safe access to the new prompt optimization system
 * from TypeScript code like prompt-engineer.ts
 */

import { StructuredMetaPrompt } from '../types/prompt-schema';

// Dynamic require to avoid TypeScript compilation issues with JS modules
// Resolve from workspace root to work in both src and dist-ts contexts
const path = require('path');
const workspaceRoot = path.resolve(__dirname, '../../../');
const { PromptOptimizer, OptimizerPresets } = require(path.join(workspaceRoot, 'src/core/prompt-optimizer'));
const { PromptTemplate } = require(path.join(workspaceRoot, 'src/prompt/template'));
const { PromptRenderer } = require(path.join(workspaceRoot, 'src/prompt/renderer'));

export interface OptimizationResult {
  prompt: string;
  tokenCount: number;
  warnings: string[];
  optimized: boolean;
  withinLimit: boolean;
}

export interface ValidationResult {
  valid: boolean;
  tokenCount: number;
  withinLimit: boolean;
  errors: string[];
  warnings: string[];
}

export interface PromptSections {
  objective: string;
  architecture: string;
  quality: string;
  nextSteps: string;
}

/**
 * Main integration class for TypeScript code
 */
export class PromptIntegration {
  private optimizer: any;

  constructor(maxTokens: number = 256, enforceLimit: boolean = false) {
    this.optimizer = new PromptOptimizer({
      maxTokens,
      enforceLimit,
      singleLine: true,
    });
  }

  /**
   * Optimize a StructuredMetaPrompt from PromptEngineer
   */
  public optimizeStructuredPrompt(
    metaPrompt: StructuredMetaPrompt
  ): OptimizationResult {
    // Reconstruct the full prompt text from structured format
    const fullPrompt = this.reconstructPromptText(metaPrompt);
    return this.optimizer.optimizeMetaPrompt(fullPrompt);
  }

  /**
   * Optimize raw prompt text
   */
  public optimizeRawPrompt(
    promptText: string,
    variables?: Record<string, any>
  ): OptimizationResult {
    return this.optimizer.optimizeMetaPrompt(promptText, variables || {});
  }

  /**
   * Validate prompt meets token requirements
   */
  public validatePrompt(prompt: string): ValidationResult {
    return this.optimizer.validatePrompt(prompt);
  }

  /**
   * Extract sections from a meta-prompt
   */
  public extractSections(metaPrompt: string): PromptSections {
    return this.optimizer.extractSections(metaPrompt);
  }

  /**
   * Get remaining token budget
   */
  public getRemainingBudget(currentPrompt: string): number {
    return this.optimizer.getRemainingTokenBudget(currentPrompt);
  }

  /**
   * Check if content can be added within budget
   */
  public canAddContent(currentPrompt: string, additionalContent: string): boolean {
    return this.optimizer.canAddContent(currentPrompt, additionalContent);
  }

  /**
   * Create prompt from template with variables
   */
  public static createFromTemplate(
    template: string,
    variables: Record<string, any>,
    options?: {
      maxTokens?: number;
      locale?: string;
      singleLine?: boolean;
      enforceLimit?: boolean;
    }
  ): string {
    return PromptOptimizer.createFromTemplate(template, variables, options);
  }

  /**
   * Estimate token count for text
   */
  public estimateTokens(text: string): number {
    return this.optimizer.estimateTokenCount(text);
  }

  /**
   * Reconstruct full prompt text from StructuredMetaPrompt
   */
  private reconstructPromptText(metaPrompt: StructuredMetaPrompt): string {
    const sections: string[] = [];

    // Clear Technical Objective
    if (metaPrompt.clearTechnicalObjective) {
      sections.push('Clear Technical Objective');
      sections.push(metaPrompt.clearTechnicalObjective);
      sections.push('');
    }

    // Key Files / Architecture
    if (metaPrompt.keyFilesArchitecture && metaPrompt.keyFilesArchitecture.length > 0) {
      sections.push('Key Files / Architecture');
      metaPrompt.keyFilesArchitecture.forEach((entry) => {
        sections.push(`- ${entry.path}: ${entry.description}`);
      });
      sections.push('');
    }

    // Quality Requirements & AST Verification
    if (
      metaPrompt.qualityRequirementsAndAstVerification &&
      metaPrompt.qualityRequirementsAndAstVerification.length > 0
    ) {
      sections.push('Quality Requirements & AST Verification');
      metaPrompt.qualityRequirementsAndAstVerification.forEach((req) => {
        sections.push(`- ${req}`);
      });
    }

    return sections.join('\n').trim();
  }
}

/**
 * Factory functions for common use cases
 */
export class PromptIntegrationFactory {
  /**
   * Create strict optimizer (enforces 256 token limit)
   */
  public static createStrict(): PromptIntegration {
    return new PromptIntegration(256, true);
  }

  /**
   * Create lenient optimizer (warns but doesn't error on limit)
   */
  public static createLenient(): PromptIntegration {
    return new PromptIntegration(256, false);
  }

  /**
   * Create extended optimizer (512 token limit)
   */
  public static createExtended(): PromptIntegration {
    return new PromptIntegration(512, false);
  }
}

/**
 * Singleton instance for global use
 */
export const promptOptimizer = new PromptIntegration(256, false);
