/**
 * Prompt Schema Definitions
 * Enforces the strict 3-section structured developer prompt format:
 * 1. Clear Technical Objective
 * 2. Key Files / Architecture
 * 3. Quality Requirements & AST Verification
 */

export interface KeyFileArchitectureEntry {
  path: string;
  description: string;
}

export interface StructuredMetaPrompt {
  clearTechnicalObjective: string;
  keyFilesArchitecture: KeyFileArchitectureEntry[];
  qualityRequirementsAndAstVerification: string[];
  rawText: string;
  generatedAt: string;
  iterationAttempts: number;
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
  };
}

export interface PromptEngineerOptions {
  maxCorrectionAttempts?: number;
  strictArchitectureCheck?: boolean;
  targetStack?: string;
  activeDomain?: string;
  callLlm?: (messages: Array<{ role: string; content: string }>) => Promise<string>;
}
