export class FileIntegrityError extends Error {
  code: string;
  details: Record<string, any>;
  constructor(message: string, code: string, details?: Record<string, any>);
}

export interface FileHashResult {
  hash: string;
  sizeBytes: number;
}

export interface VerifyHashOptions {
  algorithm?: string;
  throwOnMismatch?: boolean;
}

export interface VerifyHashResult {
  valid: boolean;
  actualHash: string;
  expectedHash: string;
  algorithm: string;
  sizeBytes: number;
}

export function calculateFileHash(filePath: string, algorithm?: string): Promise<FileHashResult>;

export function verifyFileHash(
  filePath: string,
  expectedHash: string,
  options?: VerifyHashOptions
): Promise<VerifyHashResult>;

export function verifyPostMoveChecksum(
  destPath: string,
  expectedHash: string,
  algorithm?: string
): Promise<VerifyHashResult>;
