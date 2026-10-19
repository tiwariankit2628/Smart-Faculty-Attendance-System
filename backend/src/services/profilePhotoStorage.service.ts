import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { env } from '../config/env';
import { AppError } from '../utils/apiError';
import { logger } from '../utils/logger';

export type PhotoStage = 'active' | 'pending';

export interface StoredPhotoInfo {
  reference: string;
  size: number;
  contentType: string;
  stage: PhotoStage;
  savedAt: Date;
}

export interface ValidatedImageInfo {
  contentType: string;
  extension: string;
}

export class ProfilePhotoStorageService {
  private readonly storageDir: string;
  private readonly activeDir: string;
  private readonly pendingDir: string;
  private readonly maxSizeBytes: number;

  constructor() {
    this.storageDir = path.resolve(
      env.PROFILE_PHOTO_STORAGE_PATH || path.join(process.cwd(), 'storage', 'profile_photos')
    );
    this.activeDir = path.join(this.storageDir, 'active');
    this.pendingDir = path.join(this.storageDir, 'pending');
    this.maxSizeBytes = env.MAX_PROFILE_PHOTO_SIZE_BYTES || 5 * 1024 * 1024; // 5 MB default
    this.ensureStorageDirs();
  }

  /**
   * Initializes private storage root and stage subdirectories with restrictive permissions.
   */
  private ensureStorageDirs(): void {
    try {
      if (!fs.existsSync(this.storageDir)) {
        fs.mkdirSync(this.storageDir, { recursive: true, mode: 0o700 });
      }
      if (!fs.existsSync(this.activeDir)) {
        fs.mkdirSync(this.activeDir, { recursive: true, mode: 0o700 });
      }
      if (!fs.existsSync(this.pendingDir)) {
        fs.mkdirSync(this.pendingDir, { recursive: true, mode: 0o700 });
      }
    } catch (err: unknown) {
      logger.error({ err }, 'Failed to initialize private profile photo storage directories');
    }
  }

  /**
   * Validates image buffer by checking byte boundaries and magic byte signatures.
   * Permitted formats: JPEG, PNG, WEBP.
   * Maximum size: 5 MB (or env.MAX_PROFILE_PHOTO_SIZE_BYTES).
   */
  public validateImageBuffer(buffer: Buffer): ValidatedImageInfo {
    if (!buffer || !Buffer.isBuffer(buffer)) {
      throw AppError.badRequest('Invalid image buffer payload.', 'INVALID_IMAGE_PAYLOAD');
    }

    if (buffer.length === 0) {
      throw AppError.badRequest('Image payload is empty.', 'EMPTY_IMAGE');
    }

    if (buffer.length > this.maxSizeBytes) {
      throw AppError.badRequest(
        `Profile photo size exceeds maximum limit of ${(this.maxSizeBytes / (1024 * 1024)).toFixed(0)}MB.`,
        'IMAGE_TOO_LARGE'
      );
    }

    if (buffer.length < 12) {
      throw AppError.badRequest(
        'Image file is corrupted or too small to be a valid image.',
        'MALFORMED_IMAGE'
      );
    }

    // 1. JPEG Magic Bytes: 0xFF, 0xD8, 0xFF
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return { contentType: 'image/jpeg', extension: '.jpg' };
    }

    // 2. PNG Magic Bytes: 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A
    if (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    ) {
      return { contentType: 'image/png', extension: '.png' };
    }

    // 3. WEBP Magic Bytes: 'RIFF' at 0..3 and 'WEBP' at 8..11
    const riffHeader = buffer.subarray(0, 4).toString('ascii');
    const webpHeader = buffer.subarray(8, 12).toString('ascii');
    if (riffHeader === 'RIFF' && webpHeader === 'WEBP') {
      return { contentType: 'image/webp', extension: '.webp' };
    }

    throw AppError.badRequest(
      'Invalid or unsupported image format. Permitted formats: JPEG, PNG, WEBP.',
      'UNSUPPORTED_IMAGE_FORMAT'
    );
  }

  /**
   * Resolves and validates absolute filesystem path for a reference.
   * Strictly defends against directory traversal attacks (.. or path separators).
   */
  private resolveSafePath(
    reference: string,
    stage: PhotoStage | 'auto' = 'auto'
  ): { targetPath: string; resolvedStage: PhotoStage } | null {
    if (!reference || typeof reference !== 'string') return null;

    const trimmed = reference.trim();
    const sanitizedBase = path.basename(trimmed);

    // Reject path separators, directory traversal sequences, or null characters
    if (
      sanitizedBase !== trimmed ||
      sanitizedBase.includes('..') ||
      sanitizedBase.includes('\0') ||
      sanitizedBase.includes('/') ||
      sanitizedBase.includes('\\')
    ) {
      logger.warn({ reference }, 'Blocked potential path-traversal attempt in profile photo storage');
      return null;
    }

    // Determine target directory based on stage or reference prefix
    let resolvedStage: PhotoStage;
    if (stage === 'active' || stage === 'pending') {
      resolvedStage = stage;
    } else {
      if (sanitizedBase.startsWith('photo_active_')) {
        resolvedStage = 'active';
      } else if (sanitizedBase.startsWith('photo_pending_')) {
        resolvedStage = 'pending';
      } else {
        // Fallback: check active first, then pending
        resolvedStage = 'active';
      }
    }

    const stageDir = resolvedStage === 'active' ? this.activeDir : this.pendingDir;
    const resolvedDir = path.resolve(stageDir);
    const targetPath = path.resolve(resolvedDir, sanitizedBase);

    // Enforce that path strictly resides within the designated directory
    if (!targetPath.startsWith(resolvedDir + path.sep)) {
      logger.warn({ reference, targetPath }, 'Path escape detected in profile photo storage');
      return null;
    }

    return { targetPath, resolvedStage };
  }

  /**
   * Securely saves a pending/candidate profile photo for a biometric update request.
   * Stored in private pending/ directory with restrictive permissions.
   */
  async savePendingPhoto(buffer: Buffer): Promise<StoredPhotoInfo> {
    this.ensureStorageDirs();
    const { contentType, extension } = this.validateImageBuffer(buffer);

    const opaqueId = crypto.randomUUID();
    const reference = `photo_pending_${opaqueId}${extension}`;
    const targetPath = path.join(this.pendingDir, reference);

    await fs.promises.writeFile(targetPath, buffer, { mode: 0o600 });

    logger.info(
      { reference, sizeBytes: buffer.length, contentType },
      'Pending candidate biometric profile photo saved to private vault'
    );

    return {
      reference,
      size: buffer.length,
      contentType,
      stage: 'pending',
      savedAt: new Date(),
    };
  }

  /**
   * Securely saves an active approved profile photo.
   * Stored in private active/ directory with restrictive permissions.
   */
  async saveActivePhoto(buffer: Buffer): Promise<StoredPhotoInfo> {
    this.ensureStorageDirs();
    const { contentType, extension } = this.validateImageBuffer(buffer);

    const opaqueId = crypto.randomUUID();
    const reference = `photo_active_${opaqueId}${extension}`;
    const targetPath = path.join(this.activeDir, reference);

    await fs.promises.writeFile(targetPath, buffer, { mode: 0o600 });

    logger.info(
      { reference, sizeBytes: buffer.length, contentType },
      'Active biometric profile photo saved to private vault'
    );

    return {
      reference,
      size: buffer.length,
      contentType,
      stage: 'active',
      savedAt: new Date(),
    };
  }

  /**
   * Checks whether a photo file exists in private storage.
   */
  async photoExists(reference: string, stage: PhotoStage | 'auto' = 'auto'): Promise<boolean> {
    const resolved = this.resolveSafePath(reference, stage);
    if (!resolved) return false;

    try {
      await fs.promises.access(resolved.targetPath, fs.constants.R_OK);
      return true;
    } catch {
      // If stage was 'auto' and not found, try the alternate stage directory
      if (stage === 'auto') {
        const altStage: PhotoStage = resolved.resolvedStage === 'active' ? 'pending' : 'active';
        const altResolved = this.resolveSafePath(reference, altStage);
        if (altResolved) {
          try {
            await fs.promises.access(altResolved.targetPath, fs.constants.R_OK);
            return true;
          } catch {
            return false;
          }
        }
      }
      return false;
    }
  }

  /**
   * Retrieves raw image buffer, content type, and byte length for authorized streaming.
   * Never exposes filesystem paths.
   */
  async getPhotoBuffer(
    reference: string,
    stage: PhotoStage | 'auto' = 'auto'
  ): Promise<{ buffer: Buffer; contentType: string; size: number } | null> {
    const resolved = this.resolveSafePath(reference, stage);
    if (!resolved) return null;

    let targetPath = resolved.targetPath;

    // Check if file exists at targetPath
    try {
      await fs.promises.access(targetPath, fs.constants.R_OK);
    } catch {
      // If auto, try alternate stage
      if (stage === 'auto') {
        const altStage: PhotoStage = resolved.resolvedStage === 'active' ? 'pending' : 'active';
        const altResolved = this.resolveSafePath(reference, altStage);
        if (altResolved) {
          try {
            await fs.promises.access(altResolved.targetPath, fs.constants.R_OK);
            targetPath = altResolved.targetPath;
          } catch {
            return null;
          }
        } else {
          return null;
        }
      } else {
        return null;
      }
    }

    try {
      const buffer = await fs.promises.readFile(targetPath);
      const { contentType } = this.validateImageBuffer(buffer);
      return {
        buffer,
        contentType,
        size: buffer.length,
      };
    } catch (err: unknown) {
      logger.warn({ reference, err }, 'Failed to read profile photo file buffer');
      return null;
    }
  }

  /**
   * Promotes a candidate pending photo to active storage upon administrative approval.
   * Atomically copies buffer to active/ directory with a new opaque reference,
   * then removes the candidate photo from pending/.
   */
  async promotePendingToActive(pendingReference: string): Promise<StoredPhotoInfo> {
    const photoData = await this.getPhotoBuffer(pendingReference, 'pending');
    if (!photoData) {
      throw AppError.notFound(
        'Pending candidate profile photo not found or inaccessible.',
        'PENDING_PHOTO_NOT_FOUND'
      );
    }

    // Save into active storage
    const activePhoto = await this.saveActivePhoto(photoData.buffer);

    // Safely remove the pending candidate file
    await this.deletePhoto(pendingReference, 'pending');

    logger.info(
      {
        pendingReference,
        newActiveReference: activePhoto.reference,
      },
      'Candidate profile photo successfully promoted to active storage'
    );

    return activePhoto;
  }

  /**
   * Safely deletes a photo file from disk upon rejection, update, or administrative cleanup.
   */
  async deletePhoto(reference: string, stage: PhotoStage | 'auto' = 'auto'): Promise<boolean> {
    const resolved = this.resolveSafePath(reference, stage);
    if (!resolved) return false;

    let targetPath = resolved.targetPath;

    try {
      await fs.promises.unlink(targetPath);
      logger.info({ reference, stage: resolved.resolvedStage }, 'Profile photo purged from storage');
      return true;
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        // If auto, try deleting from alternate stage
        if (stage === 'auto') {
          const altStage: PhotoStage = resolved.resolvedStage === 'active' ? 'pending' : 'active';
          const altResolved = this.resolveSafePath(reference, altStage);
          if (altResolved) {
            try {
              await fs.promises.unlink(altResolved.targetPath);
              logger.info({ reference, stage: altStage }, 'Profile photo purged from alternate storage');
              return true;
            } catch (altErr: any) {
              if (altErr.code === 'ENOENT') return true;
              return false;
            }
          }
        }
        return true;
      }
      logger.error({ reference, err }, 'Failed to delete profile photo file');
      return false;
    }
  }
}

export const profilePhotoStorageService = new ProfilePhotoStorageService();
