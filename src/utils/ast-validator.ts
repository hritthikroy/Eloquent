/**
 * AST Validator & Prompt Structure Parser
 * Validates that developer prompts adhere strictly to the 3-section format:
 * 1. Clear Technical Objective
 * 2. Key Files / Architecture
 * 3. Quality Requirements & AST Verification
 * Enforces zero conversational filler, zero markdown code fences, and stack consistency.
 */

import {
  PromptValidationResult,
  StructuredMetaPrompt,
  KeyFileArchitectureEntry
} from '../types/prompt-schema';

export class PromptAstValidator {
  // Conversational filler phrases that invalidate developer prompts
  private static readonly FILLER_PATTERNS: RegExp[] = [
    /^(sure|certainly|absolutely|okay|ok|yes|great)[,!.]/i,
    /^(here\s+(is|are)|below\s+(is|are)|i\s+can\s+help|here\s+you\s+go)/i,
    /^(as\s+requested|as\s+an\s+ai|happy\s+to\s+help|hope\s+this\s+helps)/i,
    /(let\s+me\s+know\s+if\s+you\s+need|feel\s+free\s+to\s+ask|enjoy\s+coding)/i,
    /\b(cheers|warm\s+regards|best\s+wishes|sincerely)\b/i
  ];

  // Section header regexes
  private static readonly SECTION_OBJECTIVE_REGEX =
    /^(#+\s*)?Clear\s+Technical\s+Objective[:\s]*$/im;

  private static readonly SECTION_ARCHITECTURE_REGEX =
    /^(#+\s*)?Key\s+Files\s*\/\s*Architecture[:\s]*$/im;

  private static readonly SECTION_QUALITY_REGEX =
    /^(#+\s*)?Quality\s+Requirements\s*(&|and)\s*AST\s+Verification[:\s]*$/im;

  // Valid Eloquent stack prefixes to prevent out-of-domain hallucinations
  private static readonly VALID_STACK_PREFIXES = [
    'src/',
    'backend/',
    'backend-go/',
    'electron/',
    'tests/',
    'userData/',
    'scripts/',
    'package.json',
    'tsconfig.json',
    '.env',
    'go.mod',
    'go.sum',
    'webpack.config.js'
  ];

  /**
   * Remove enclosing markdown code fences (``` or ```markdown / ```text)
   */
  public static stripCodeFences(text: string): string {
    if (!text) return '';
    let cleaned = text.trim();
    // Strip leading ```lang
    cleaned = cleaned.replace(/^```[a-zA-Z0-9_-]*\s*\n?/, '');
    // Strip trailing ```
    cleaned = cleaned.replace(/\n?```\s*$/, '');
    return cleaned.trim();
  }

  /**
   * Remove any conversational preamble before "Clear Technical Objective"
   */
  public static stripPreambleAndPostamble(text: string): string {
    if (!text) return '';
    const cleaned = this.stripCodeFences(text);

    // Find first occurrence of "Clear Technical Objective"
    const objMatch = cleaned.match(this.SECTION_OBJECTIVE_REGEX);
    if (!objMatch || objMatch.index === undefined) {
      return cleaned;
    }

    const startIdx = objMatch.index;
    return cleaned.slice(startIdx).trim();
  }

  /**
   * Validate raw text against strict prompt schema rules
   */
  public static validate(rawText: string, targetStack: string = 'Node.js, Electron, Go audio backend'): PromptValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const detectedFiller: string[] = [];

    if (!rawText || rawText.trim().length === 0) {
      return {
        isValid: false,
        errors: ['Prompt is completely empty'],
        warnings: [],
        detectedFiller: [],
        hasCodeBlockWrapper: false,
        hasPreamble: false,
        sectionsFound: { objective: false, architecture: false, quality: false }
      };
    }

    const trimmed = rawText.trim();
    const hasCodeBlockWrapper = /^```/.test(trimmed) || /```$/.test(trimmed);
    if (hasCodeBlockWrapper) {
      errors.push('Prompt must be strictly plain text without enclosing markdown code fences (```)');
    }

    // Check for conversational filler
    const lines = trimmed.split('\n');
    const firstNonEmptyLine = lines.find(l => l.trim().length > 0) || '';

    for (const pattern of this.FILLER_PATTERNS) {
      if (pattern.test(firstNonEmptyLine) || pattern.test(trimmed)) {
        const match = trimmed.match(pattern);
        if (match) {
          detectedFiller.push(match[0]);
          errors.push(`Detected conversational filler: "${match[0]}". Must be authoritative plain developer instruction.`);
        }
      }
    }

    // Check for exact 3 required sections
    const hasObjective = this.SECTION_OBJECTIVE_REGEX.test(trimmed);
    const hasArchitecture = this.SECTION_ARCHITECTURE_REGEX.test(trimmed);
    const hasQuality = this.SECTION_QUALITY_REGEX.test(trimmed);

    if (!hasObjective) errors.push('Missing required section: "Clear Technical Objective"');
    if (!hasArchitecture) errors.push('Missing required section: "Key Files / Architecture"');
    if (!hasQuality) errors.push('Missing required section: "Quality Requirements & AST Verification"');

    // Check if the prompt starts directly with the Objective section
    const hasPreamble = !this.SECTION_OBJECTIVE_REGEX.test(firstNonEmptyLine.replace(/^[#\s]+/, ''));
    if (hasPreamble && hasObjective) {
      errors.push('Prompt contains conversational preamble prior to "Clear Technical Objective" header');
    }

    // Validate file paths in the Architecture section
    if (hasArchitecture) {
      const ast = this.parseToAst(trimmed);
      if (ast) {
        if (ast.keyFilesArchitecture.length === 0) {
          errors.push('"Key Files / Architecture" section must list at least one concrete file path');
        } else {
          for (const file of ast.keyFilesArchitecture) {
            const isKnownStackPath = this.VALID_STACK_PREFIXES.some(prefix => file.path.startsWith(prefix));
            if (!isKnownStackPath) {
              warnings.push(`File path "${file.path}" does not match standard Eloquent stack prefix (${this.VALID_STACK_PREFIXES.slice(0, 3).join(', ')}...)`);
            }
          }
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      detectedFiller,
      hasCodeBlockWrapper,
      hasPreamble,
      sectionsFound: {
        objective: hasObjective,
        architecture: hasArchitecture,
        quality: hasQuality
      }
    };
  }

  /**
   * Custom AST Parser that breaks prompt text into strongly-typed StructuredMetaPrompt
   */
  public static parseToAst(promptText: string): StructuredMetaPrompt | null {
    const cleaned = this.stripCodeFences(promptText);
    const lines = cleaned.split('\n');

    let currentSection: 'NONE' | 'OBJECTIVE' | 'ARCHITECTURE' | 'QUALITY' = 'NONE';
    const objectiveLines: string[] = [];
    const architectureEntries: KeyFileArchitectureEntry[] = [];
    const qualityLines: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();

      if (this.SECTION_OBJECTIVE_REGEX.test(trimmed)) {
        currentSection = 'OBJECTIVE';
        continue;
      } else if (this.SECTION_ARCHITECTURE_REGEX.test(trimmed)) {
        currentSection = 'ARCHITECTURE';
        continue;
      } else if (this.SECTION_QUALITY_REGEX.test(trimmed)) {
        currentSection = 'QUALITY';
        continue;
      }

      if (currentSection === 'OBJECTIVE') {
        if (trimmed.length > 0) objectiveLines.push(trimmed);
      } else if (currentSection === 'ARCHITECTURE') {
        if (trimmed.startsWith('-') || trimmed.startsWith('*')) {
          // Parse: - `path/to/file.ts`: Description or - path/to/file.ts: Description
          const entryMatch = trimmed.match(/^[-*]\s*`?([^`:]+)`?[:\s-]+(.*)$/);
          if (entryMatch) {
            architectureEntries.push({
              path: entryMatch[1].trim(),
              description: entryMatch[2].trim()
            });
          } else {
            architectureEntries.push({
              path: trimmed.replace(/^[-*]\s*/, '').trim(),
              description: ''
            });
          }
        }
      } else if (currentSection === 'QUALITY') {
        if (trimmed.startsWith('-') || trimmed.startsWith('*')) {
          qualityLines.push(trimmed.replace(/^[-*]\s*/, '').trim());
        } else if (trimmed.length > 0) {
          qualityLines.push(trimmed);
        }
      }
    }

    return {
      clearTechnicalObjective: objectiveLines.join(' ').trim(),
      keyFilesArchitecture: architectureEntries,
      qualityRequirementsAndAstVerification: qualityLines,
      rawText: cleaned,
      generatedAt: new Date().toISOString(),
      iterationAttempts: 1
    };
  }
}
