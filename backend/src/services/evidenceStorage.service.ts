import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { env } from '../config/env';
import { logger } from '../utils/logger';

export interface StoredEvidenceInfo {
  reference: string;
  size: number;
  contentType: string;
}

export class EvidenceStorageService {
  private readonly storageDir: string;

  constructor() {
    this.storageDir = path.resolve(env.EVIDENCE_STORAGE_PATH || path.join(process.cwd(), 'storage', 'evidence'));
    this.ensureStorageDir();
  }

  private ensureStorageDir(): void {
    try {
      if (!fs.existsSync(this.storageDir)) {
        fs.mkdirSync(this.storageDir, { recursive: true, mode: 0o700 });
      }
    } catch (err: unknown) {
      logger.error({ err }, 'Failed to initialize evidence storage directory');
    }
  }

  /**
   * Securely saves an evidence JPEG buffer to private, non-public storage.
   * Generates a completely opaque UUID reference.
   */
  async saveEvidence(buffer: Buffer, contentType = 'image/jpeg'): Promise<StoredEvidenceInfo> {
    this.ensureStorageDir();

    const opaqueId = crypto.randomUUID();
    const reference = `ev_${opaqueId}.jpg`;
    const targetPath = path.resolve(this.storageDir, reference);

    await fs.promises.writeFile(targetPath, buffer, { mode: 0o600 });

    logger.info(
      {
        reference,
        sizeBytes: buffer.length,
        contentType,
      },
      'Biometric attendance verification evidence securely stored in private vault'
    );

    return {
      reference,
      size: buffer.length,
      contentType,
    };
  }

  /**
   * Resolves and validates the absolute path for an opaque reference.
   * Defends strictly against path-traversal attacks (e.g. ../ or /etc/passwd).
   */
  private resolveSafePath(reference: string): string | null {
    if (!reference || typeof reference !== 'string') return null;

    // Reject path separators or suspicious characters directly
    const sanitizedBase = path.basename(reference.trim());
    if (sanitizedBase !== reference.trim() || sanitizedBase.includes('..')) {
      logger.warn({ reference }, 'Blocked potential path-traversal attempt in evidence storage');
      return null;
    }

    const resolvedDir = path.resolve(this.storageDir);
    const targetPath = path.resolve(resolvedDir, sanitizedBase);

    // Path must strictly reside within the designated storage directory
    if (!targetPath.startsWith(resolvedDir + path.sep)) {
      logger.warn({ reference, targetPath }, 'Path escape detected in evidence storage');
      return null;
    }

    return targetPath;
  }

  /**
   * Checks whether evidence file exists in private storage.
   */
  async evidenceExists(reference: string): Promise<boolean> {
    const targetPath = this.resolveSafePath(reference);
    if (!targetPath) return false;

    try {
      await fs.promises.access(targetPath, fs.constants.R_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Retrieves the raw evidence image buffer for authorized admin access.
   */
  async getEvidenceBuffer(reference: string): Promise<Buffer | null> {
    const targetPath = this.resolveSafePath(reference);
    if (!targetPath) return null;

    try {
      return await fs.promises.readFile(targetPath);
    } catch (err: unknown) {
      logger.warn({ reference, err }, 'Evidence file read failure');
      return null;
    }
  }

  /**
   * Securely deletes an evidence file upon policy expiration or administrative purge.
   */
  async deleteEvidence(reference: string): Promise<boolean> {
    const targetPath = this.resolveSafePath(reference);
    if (!targetPath) return false;

    try {
      await fs.promises.unlink(targetPath);
      logger.info({ reference }, 'Expired biometric evidence file purged from disk');
      return true;
    } catch (err: any) {
      if (err.code === 'ENOENT') return true; // Already gone
      logger.error({ reference, err }, 'Failed to delete expired evidence file');
      return false;
    }
  }
}

export const evidenceStorageService = new EvidenceStorageService();
