/**
 * Eloquent Build Subsystem - HashVerifier
 * 
 * Logic to compare current binary hashes against the manifest
 * to prevent build corruption and validate executable signatures.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

export interface BinaryMetadata {
  hash: string;
  sizeBytes: number;
  platform?: string;
  arch?: string;
  signature?: string;
  optional?: boolean;
}

export interface BinaryManifest {
  version: string;
  timestamp: string;
  algorithm: string;
  binaries: Record<string, BinaryMetadata>;
}

export interface HashVerificationResult {
  valid: boolean;
  actualHash: string;
  expectedHash: string;
  sizeBytes: number;
  binaryPath: string;
  algorithm: string;
  error?: string;
}

export interface BatchVerificationResult {
  valid: boolean;
  totalChecked: number;
  matchedCount: number;
  mismatchedCount: number;
  missingCount: number;
  details: Record<string, HashVerificationResult>;
}

export interface BinarySignatureResult {
  valid: boolean;
  format: 'macho-64' | 'macho-32' | 'elf' | 'pe' | 'unknown';
  architecture?: string;
  sizeBytes: number;
  error?: string;
}

export class BinaryCorruptionError extends Error {
  public code: string;
  public details: Record<string, any>;

  constructor(message: string, code: string, details: Record<string, any> = {}) {
    super(message);
    this.name = 'BinaryCorruptionError';
    this.code = code;
    this.details = details;
  }
}

export class HashVerifier {
  private rootDir: string;
  private defaultAlgorithm: string;

  constructor(rootDir: string = process.cwd(), defaultAlgorithm: string = 'sha256') {
    this.rootDir = rootDir;
    this.defaultAlgorithm = defaultAlgorithm;
  }

  /**
   * Calculate SHA-256 (or custom) hash of a binary file.
   */
  public async calculateHash(filePath: string, algorithm: string = this.defaultAlgorithm): Promise<{ hash: string; sizeBytes: number }> {
    const fullPath = path.isAbsolute(filePath) ? filePath : path.resolve(this.rootDir, filePath);

    if (!fs.existsSync(fullPath)) {
      throw new BinaryCorruptionError(
        `[HashVerifier] Binary file not found: "${fullPath}"`,
        'ERR_BINARY_MISSING',
        { filePath: fullPath }
      );
    }

    return new Promise((resolve, reject) => {
      let sizeBytes = 0;
      let hashStream: crypto.Hash;

      try {
        hashStream = crypto.createHash(algorithm);
      } catch (err: any) {
        return reject(new BinaryCorruptionError(`Unsupported algorithm: ${algorithm}`, 'ERR_UNSUPPORTED_ALGORITHM', { algorithm }));
      }

      const stream = fs.createReadStream(fullPath);

      stream.on('data', (chunk) => {
        sizeBytes += chunk.length;
        hashStream.update(chunk);
      });

      stream.on('end', () => {
        resolve({
          hash: hashStream.digest('hex'),
          sizeBytes
        });
      });

      stream.on('error', (err: any) => {
        reject(new BinaryCorruptionError(
          `[HashVerifier] Failed to read binary "${fullPath}": ${err.message}`,
          err.code || 'ERR_IO',
          { filePath: fullPath, originalError: err }
        ));
      });
    });
  }

  /**
   * Verify a binary file's cryptographic hash against expected hash using constant-time comparison.
   */
  public async verifyBinaryHash(
    filePath: string,
    expectedHash: string,
    algorithm: string = this.defaultAlgorithm
  ): Promise<HashVerificationResult> {
    const fullPath = path.isAbsolute(filePath) ? filePath : path.resolve(this.rootDir, filePath);

    try {
      const { hash: actualHash, sizeBytes } = await this.calculateHash(fullPath, algorithm);

      const normExpected = expectedHash.trim().toLowerCase();
      const normActual = actualHash.trim().toLowerCase();

      let valid = false;
      if (normExpected.length === normActual.length) {
        try {
          const bufExpected = Buffer.from(normExpected, 'hex');
          const bufActual = Buffer.from(normActual, 'hex');
          valid = bufExpected.length === bufActual.length && crypto.timingSafeEqual(bufExpected, bufActual);
        } catch {
          valid = normExpected === normActual;
        }
      }

      return {
        valid,
        actualHash: normActual,
        expectedHash: normExpected,
        sizeBytes,
        binaryPath: filePath,
        algorithm
      };
    } catch (err: any) {
      return {
        valid: false,
        actualHash: '',
        expectedHash,
        sizeBytes: 0,
        binaryPath: filePath,
        algorithm,
        error: err.message
      };
    }
  }

  /**
   * Validate low-level binary executable signature / header format
   * (e.g. Mach-O on Darwin, ELF on Linux, PE/COFF on Windows).
   */
  public async verifyBinarySignature(filePath: string): Promise<BinarySignatureResult> {
    const fullPath = path.isAbsolute(filePath) ? filePath : path.resolve(this.rootDir, filePath);

    if (!fs.existsSync(fullPath)) {
      return {
        valid: false,
        format: 'unknown',
        sizeBytes: 0,
        error: `Binary not found at "${fullPath}"`
      };
    }

    try {
      const fd = fs.openSync(fullPath, 'r');
      const headerBuffer = Buffer.alloc(16);
      fs.readSync(fd, headerBuffer, 0, 16, 0);
      fs.closeSync(fd);

      const stats = fs.statSync(fullPath);
      const magic32LE = headerBuffer.readUInt32LE(0);
      const magic32BE = headerBuffer.readUInt32BE(0);

      // Mach-O Magic Numbers (macOS)
      // 0xFEEDFACF = 64-bit Mach-O (0xCFFAEDFE in LE)
      // 0xFEEDFACE = 32-bit Mach-O (0xCEFAEDFE in LE)
      if (magic32BE === 0xFEEDFACF || magic32LE === 0xFEEDFACF) {
        return {
          valid: true,
          format: 'macho-64',
          architecture: process.arch,
          sizeBytes: stats.size
        };
      }

      if (magic32BE === 0xFEEDFACE || magic32LE === 0xFEEDFACE) {
        return {
          valid: true,
          format: 'macho-32',
          sizeBytes: stats.size
        };
      }

      // Universal / Fat binary magic: 0xCAFEBABE
      if (magic32BE === 0xCAFEBABE || magic32LE === 0xCAFEBABE) {
        return {
          valid: true,
          format: 'macho-64',
          architecture: 'universal',
          sizeBytes: stats.size
        };
      }

      // ELF Magic (Linux): 0x7F 'E' 'L' 'F'
      if (headerBuffer[0] === 0x7F && headerBuffer[1] === 0x45 && headerBuffer[2] === 0x4C && headerBuffer[3] === 0x46) {
        return {
          valid: true,
          format: 'elf',
          architecture: headerBuffer[4] === 2 ? '64-bit' : '32-bit',
          sizeBytes: stats.size
        };
      }

      // PE / MZ Header (Windows): 'M' 'Z'
      if (headerBuffer[0] === 0x4D && headerBuffer[1] === 0x5A) {
        return {
          valid: true,
          format: 'pe',
          sizeBytes: stats.size
        };
      }

      return {
        valid: false,
        format: 'unknown',
        sizeBytes: stats.size,
        error: `Unrecognized binary executable header magic: 0x${headerBuffer.slice(0, 4).toString('hex')}`
      };
    } catch (err: any) {
      return {
        valid: false,
        format: 'unknown',
        sizeBytes: 0,
        error: `Failed to inspect binary header: ${err.message}`
      };
    }
  }

  /**
   * Verify all binaries in a manifest.
   */
  public async verifyManifest(
    manifest: BinaryManifest,
    options: { throwOnMismatch?: boolean; allowMissingOptional?: boolean } = {}
  ): Promise<BatchVerificationResult> {
    const result: BatchVerificationResult = {
      valid: true,
      totalChecked: 0,
      matchedCount: 0,
      mismatchedCount: 0,
      missingCount: 0,
      details: {}
    };

    const throwOnMismatch = options.throwOnMismatch === true;
    const allowMissingOptional = options.allowMissingOptional !== false;

    for (const [relPath, meta] of Object.entries(manifest.binaries)) {
      result.totalChecked++;
      const fullPath = path.resolve(this.rootDir, relPath);

      if (!fs.existsSync(fullPath)) {
        result.missingCount++;
        result.details[relPath] = {
          valid: false,
          actualHash: '',
          expectedHash: meta.hash,
          sizeBytes: 0,
          binaryPath: relPath,
          algorithm: manifest.algorithm,
          error: 'Binary does not exist on disk'
        };

        if (meta.optional && allowMissingOptional) {
          // Optional binary can be missing
          continue;
        }

        result.valid = false;
        if (throwOnMismatch) {
          throw new BinaryCorruptionError(
            `[HashVerifier] Required binary "${relPath}" is missing from build workspace`,
            'ERR_BINARY_MISSING',
            { binaryPath: relPath }
          );
        }
        continue;
      }

      const res = await this.verifyBinaryHash(fullPath, meta.hash, manifest.algorithm);
      result.details[relPath] = res;

      if (res.valid) {
        result.matchedCount++;
      } else {
        result.mismatchedCount++;
        result.valid = false;
        if (throwOnMismatch) {
          throw new BinaryCorruptionError(
            `[HashVerifier] Binary hash mismatch for "${relPath}". Expected: ${meta.hash}, Got: ${res.actualHash}`,
            'ERR_HASH_MISMATCH',
            { binaryPath: relPath, expected: meta.hash, actual: res.actualHash }
          );
        }
      }
    }

    return result;
  }

  /**
   * Generate a fresh manifest from active binaries on disk.
   */
  public async generateManifest(binaryRelPaths: string[], version: string = '1.0.0'): Promise<BinaryManifest> {
    const manifest: BinaryManifest = {
      version,
      timestamp: new Date().toISOString(),
      algorithm: this.defaultAlgorithm,
      binaries: {}
    };

    for (const relPath of binaryRelPaths) {
      const fullPath = path.resolve(this.rootDir, relPath);
      if (!fs.existsSync(fullPath)) {
        continue;
      }

      const { hash, sizeBytes } = await this.calculateHash(fullPath, this.defaultAlgorithm);
      const sig = await this.verifyBinarySignature(fullPath);

      manifest.binaries[relPath] = {
        hash,
        sizeBytes,
        platform: process.platform,
        arch: process.arch,
        signature: sig.valid ? sig.format : 'raw'
      };
    }

    return manifest;
  }

  /**
   * Load manifest from disk.
   */
  public loadManifest(filePath: string): BinaryManifest {
    const fullPath = path.isAbsolute(filePath) ? filePath : path.resolve(this.rootDir, filePath);
    if (!fs.existsSync(fullPath)) {
      throw new BinaryCorruptionError(
        `[HashVerifier] Manifest file not found: "${fullPath}"`,
        'ERR_MANIFEST_NOT_FOUND',
        { filePath: fullPath }
      );
    }

    try {
      const content = fs.readFileSync(fullPath, 'utf8');
      return JSON.parse(content) as BinaryManifest;
    } catch (err: any) {
      throw new BinaryCorruptionError(
        `[HashVerifier] Failed to parse manifest "${fullPath}": ${err.message}`,
        'ERR_INVALID_MANIFEST',
        { filePath: fullPath, originalError: err }
      );
    }
  }

  /**
   * Save manifest to disk atomically.
   */
  public saveManifest(manifest: BinaryManifest, filePath: string): void {
    const fullPath = path.isAbsolute(filePath) ? filePath : path.resolve(this.rootDir, filePath);
    const tmpPath = `${fullPath}.tmp.${Date.now()}`;

    try {
      const content = JSON.stringify(manifest, null, 2);
      fs.writeFileSync(tmpPath, content, 'utf8');
      fs.renameSync(tmpPath, fullPath);
    } catch (err: any) {
      if (fs.existsSync(tmpPath)) {
        try { fs.unlinkSync(tmpPath); } catch {}
      }
      throw new BinaryCorruptionError(
        `[HashVerifier] Failed saving manifest to "${fullPath}": ${err.message}`,
        'ERR_MANIFEST_WRITE_FAILED',
        { filePath: fullPath, originalError: err }
      );
    }
  }
}
