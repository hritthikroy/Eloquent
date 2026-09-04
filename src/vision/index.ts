/**
 * @file index.ts
 * @description Public entry point for the Eloquent Vision prompt composition service.
 * Exposes buildPrompt(intent: string): string and the PromptBuilder class.
 */

export {
  PromptBuilder,
  buildPrompt,
  ANTIGRAVITY_PROMPT_REGEX,
  PromptBuilderOptions,
  ParsedIntent,
  PromptValidationResult,
} from './promptBuilder';

export { default } from './promptBuilder';
