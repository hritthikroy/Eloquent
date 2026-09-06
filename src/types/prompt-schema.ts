/**
 * Prompt Schema Definitions
 * Enforces the strict structured developer prompt format:
 * 1. Clear Technical Objective
 * 2. Key Files / Architecture
 * 3. Quality Requirements & AST Verification
 * 4. Next Steps & Continuation Roadmap (Optional / Canonical Extension)
 */

export interface KeyFileArchitectureEntry {
  path: string;
  description: string;
}

export interface StructuredMetaPrompt {
  clearTechnicalObjective: string;
  keyFilesArchitecture: KeyFileArchitectureEntry[];
  qualityRequirementsAndAstVerification: string[];
  nextStepsContinuationRoadmap?: string[];
  rawText: string;
  generatedAt: string;
  iterationAttempts: number;
  tokenCount?: number;
}

export interface PromptValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  detectedFiller: string[];
  hasCodeBlockWrapper: boolean;
  hasPreamble: boolean;
  sectionsFound: {
    objective: boolean;
    architecture: boolean;
    quality: boolean;
    roadmap?: boolean;
  };
}

export interface PromptEngineerOptions {
  maxCorrectionAttempts?: number;
  strictArchitectureCheck?: boolean;
  targetStack?: string;
  activeDomain?: string;
  maxTokens?: number;
  enforceTokenLimit?: boolean;
  callLlm?: (messages: Array<{ role: string; content: string }>) => Promise<string>;
}
