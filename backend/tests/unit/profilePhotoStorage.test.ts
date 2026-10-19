import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { profilePhotoStorageService } from '../../src/services/profilePhotoStorage.service';
import { AppError } from '../../src/utils/apiError';

describe('ProfilePhotoStorageService Unit Tests', () => {
  // Test image buffers
  const validJpegBuffer = Buffer.from(
    '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
    'base64'
  );

  // 1x1 transparent PNG
  const validPngBuffer = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64'
  );

  // Minimal valid WEBP (RIFF + WEBP header)
  const validWebpBuffer = Buffer.concat([
    Buffer.from('RIFF'),
    Buffer.from([0x1a, 0x00, 0x00, 0x00]), // 26 bytes file size
    Buffer.from('WEBPVP8 '),
    Buffer.from([0x0e, 0x00, 0x00, 0x00, 0x30, 0x01, 0x00, 0x9d, 0x01, 0x2a, 0x01, 0x00, 0x01, 0x00]),
  ]);

  const createdPendingRefs: string[] = [];
  const createdActiveRefs: string[] = [];

  afterAll(async () => {
    // Clean up any test files
    for (const ref of createdPendingRefs) {
      await profilePhotoStorageService.deletePhoto(ref, 'pending');
    }
    for (const ref of createdActiveRefs) {
      await profilePhotoStorageService.deletePhoto(ref, 'active');
    }
  });

  describe('Image Byte & Format Validation', () => {
    it('1. should validate and detect JPEG format correctly', () => {
      const info = profilePhotoStorageService.validateImageBuffer(validJpegBuffer);
      expect(info.contentType).toBe('image/jpeg');
      expect(info.extension).toBe('.jpg');
    });

    it('2. should validate and detect PNG format correctly', () => {
      const info = profilePhotoStorageService.validateImageBuffer(validPngBuffer);
      expect(info.contentType).toBe('image/png');
      expect(info.extension).toBe('.png');
    });

    it('3. should validate and detect WEBP format correctly', () => {
      const info = profilePhotoStorageService.validateImageBuffer(validWebpBuffer);
      expect(info.contentType).toBe('image/webp');
      expect(info.extension).toBe('.webp');
    });

    it('4. should reject unsupported image types (e.g. GIF / text)', () => {
      const gifBuffer = Buffer.from('GIF89a\x01\x00\x01\x00\x80\x00\x00\xff\xff\xff\x00\x00\x00!\xf9\x04\x01\x00\x00\x00\x00,\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02D\x01\x00;');
      expect(() => profilePhotoStorageService.validateImageBuffer(gifBuffer)).toThrow(AppError);

      try {
        profilePhotoStorageService.validateImageBuffer(gifBuffer);
      } catch (err: any) {
        expect(err.code).toBe('UNSUPPORTED_IMAGE_FORMAT');
      }

      const textBuffer = Buffer.from('Hello, this is just a plain text file pretending to be an image!');
      expect(() => profilePhotoStorageService.validateImageBuffer(textBuffer)).toThrow(AppError);
    });

    it('5. should reject malformed or truncated image buffers (< 12 bytes)', () => {
      const tinyBuffer = Buffer.from([0xff, 0xd8, 0xff]); // only 3 bytes
      expect(() => profilePhotoStorageService.validateImageBuffer(tinyBuffer)).toThrow(AppError);

      try {
        profilePhotoStorageService.validateImageBuffer(tinyBuffer);
      } catch (err: any) {
        expect(err.code).toBe('MALFORMED_IMAGE');
      }
    });

    it('6. should reject empty buffers', () => {
      expect(() => profilePhotoStorageService.validateImageBuffer(Buffer.alloc(0))).toThrow(AppError);
    });

    it('7. should enforce maximum image size limit (5MB)', () => {
      // 5MB + 1 byte
      const oversizedBuffer = Buffer.alloc(5 * 1024 * 1024 + 1);
      // Put JPEG header at start
      oversizedBuffer[0] = 0xff;
      oversizedBuffer[1] = 0xd8;
      oversizedBuffer[2] = 0xff;

      expect(() => profilePhotoStorageService.validateImageBuffer(oversizedBuffer)).toThrow(AppError);
      try {
        profilePhotoStorageService.validateImageBuffer(oversizedBuffer);
      } catch (err: any) {
        expect(err.code).toBe('IMAGE_TOO_LARGE');
      }
    });
  });

  describe('Pending & Active Storage Operations', () => {
    it('8. should save a pending photo with a cryptographically random reference', async () => {
      const stored = await profilePhotoStorageService.savePendingPhoto(validJpegBuffer);
      createdPendingRefs.push(stored.reference);

      expect(stored.reference).toMatch(/^photo_pending_[0-9a-fA-F-]{36}\.jpg$/);
      expect(stored.stage).toBe('pending');
      expect(stored.contentType).toBe('image/jpeg');
      expect(stored.size).toBe(validJpegBuffer.length);
    });

    it('9. should save an active photo with a cryptographically random reference', async () => {
      const stored = await profilePhotoStorageService.saveActivePhoto(validPngBuffer);
      createdActiveRefs.push(stored.reference);

      expect(stored.reference).toMatch(/^photo_active_[0-9a-fA-F-]{36}\.png$/);
      expect(stored.stage).toBe('active');
      expect(stored.contentType).toBe('image/png');
      expect(stored.size).toBe(validPngBuffer.length);
    });

    it('10. should maintain strict physical separation between pending and active folders', async () => {
      const pendingStored = await profilePhotoStorageService.savePendingPhoto(validJpegBuffer);
      createdPendingRefs.push(pendingStored.reference);

      // Verify pending photo exists in pending stage
      const existsInPending = await profilePhotoStorageService.photoExists(pendingStored.reference, 'pending');
      expect(existsInPending).toBe(true);

      // Verify pending photo does NOT exist in active stage
      const existsInActive = await profilePhotoStorageService.photoExists(pendingStored.reference, 'active');
      expect(existsInActive).toBe(false);
    });

    it('11. should retrieve stored photo buffer without exposing filesystem paths', async () => {
      const pendingStored = await profilePhotoStorageService.savePendingPhoto(validWebpBuffer);
      createdPendingRefs.push(pendingStored.reference);

      const retrieved = await profilePhotoStorageService.getPhotoBuffer(pendingStored.reference);
      expect(retrieved).not.toBeNull();
      expect(retrieved!.contentType).toBe('image/webp');
      expect(retrieved!.size).toBe(validWebpBuffer.length);
      expect(retrieved!.buffer.equals(validWebpBuffer)).toBe(true);
    });

    it('12. should safely handle non-existent reference retrieval', async () => {
      const nonExistent = `photo_active_00000000-0000-0000-0000-000000000000.jpg`;
      const exists = await profilePhotoStorageService.photoExists(nonExistent);
      expect(exists).toBe(false);

      const buffer = await profilePhotoStorageService.getPhotoBuffer(nonExistent);
      expect(buffer).toBeNull();
    });

    it('13. should promote a pending photo to active storage upon approval', async () => {
      const pendingStored = await profilePhotoStorageService.savePendingPhoto(validJpegBuffer);
      createdPendingRefs.push(pendingStored.reference);

      // Promote to active
      const activeStored = await profilePhotoStorageService.promotePendingToActive(pendingStored.reference);
      createdActiveRefs.push(activeStored.reference);

      // Verify active reference format
      expect(activeStored.reference).toMatch(/^photo_active_[0-9a-fA-F-]{36}\.jpg$/);
      expect(activeStored.stage).toBe('active');
      expect(activeStored.size).toBe(validJpegBuffer.length);

      // Verify active photo exists in active storage
      const activeExists = await profilePhotoStorageService.photoExists(activeStored.reference, 'active');
      expect(activeExists).toBe(true);

      // Verify pending photo was cleaned up from pending storage
      const pendingStillExists = await profilePhotoStorageService.photoExists(pendingStored.reference, 'pending');
      expect(pendingStillExists).toBe(false);
    });

    it('14. should safely delete a photo from disk', async () => {
      const stored = await profilePhotoStorageService.savePendingPhoto(validJpegBuffer);

      const existsBefore = await profilePhotoStorageService.photoExists(stored.reference);
      expect(existsBefore).toBe(true);

      const deleted = await profilePhotoStorageService.deletePhoto(stored.reference);
      expect(deleted).toBe(true);

      const existsAfter = await profilePhotoStorageService.photoExists(stored.reference);
      expect(existsAfter).toBe(false);

      // Redundant deletion should return true safely (idempotent)
      const redundantDelete = await profilePhotoStorageService.deletePhoto(stored.reference);
      expect(redundantDelete).toBe(true);
    });
  });

  describe('Security & Path Traversal Protections', () => {
    it('15. should block path traversal attempts with ../ or nested directories', async () => {
      const maliciousRefs = [
        '../../etc/passwd',
        '..\\..\\windows\\win.ini',
        '../pending/evil.jpg',
        'active/../../secret.txt',
        'sub/folder/photo.jpg',
        'photo_pending_123.jpg\0.png',
      ];

      for (const badRef of maliciousRefs) {
        const exists = await profilePhotoStorageService.photoExists(badRef);
        expect(exists).toBe(false);

        const buffer = await profilePhotoStorageService.getPhotoBuffer(badRef);
        expect(buffer).toBeNull();

        const deleted = await profilePhotoStorageService.deletePhoto(badRef);
        expect(deleted).toBe(false);
      }
    });
  });
});
