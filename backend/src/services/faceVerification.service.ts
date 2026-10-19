import { env } from '../config/env';
import { AppError } from '../utils/apiError';
import { logger } from '../utils/logger';

export interface FaceVerificationResult {
  verified: boolean;
  identityMatched: boolean;
  similarity: number;
  distance: number;
  confidence: number;
  livenessScore: number;
  isLive: boolean;
  livenessVerified: boolean;
  livenessStatus: string;
  reason?: string;
  errorCode?: string;
  bestFrameIndex?: number;
}

export class FaceVerificationService {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly timeoutMs: number;

  constructor() {
    this.baseUrl = env.FACE_SERVICE_URL.replace(/\/+$/, '');
    this.apiKey = env.FACE_SERVICE_API_KEY;
    this.timeoutMs = 10000; // 10 second timeout
  }

  /**
   * Registers a faculty face photo with the Python FastAPI face service
   * Returns a persistent embedding reference identifier
   */
  async registerFace(facultyId: string, imageBase64: string): Promise<string> {
    if (env.MOCK_FACE_SERVICE) {
      logger.info({ facultyId }, 'Face registered via mock service pipeline (MOCK_FACE_SERVICE=true)');
      return `emb_mock_${facultyId}_${Date.now()}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      logger.info({ facultyId, url: `${this.baseUrl}/api/v1/face/register` }, 'Calling external Face Verification Service for registration');

      const response = await fetch(`${this.baseUrl}/api/v1/face/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
        },
        body: JSON.stringify({
          facultyId,
          image: imageBase64,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorBody: any = await response.json().catch(() => ({}));
        logger.warn({ status: response.status, errorBody }, 'Face service registration responded with error');

        if (response.status >= 500) {
          throw new AppError(
            503,
            'FACE_SERVICE_UNAVAILABLE',
            'Face verification service encountered an internal error during face registration.'
          );
        }

        const errDetail = errorBody.detail || errorBody;
        const code = typeof errDetail === 'object' ? errDetail.code : errorBody.code;
        const message = typeof errDetail === 'object' ? errDetail.message : (typeof errDetail === 'string' ? errDetail : errorBody.message);

        throw new AppError(
          response.status || 400,
          code || 'FACE_REGISTRATION_FAILED',
          message || 'Face registration failed. Please ensure lighting is good and face is clearly visible.'
        );
      }

      const data: any = await response.json();
      const reference = data.faceEmbeddingReference || data.embeddingId || data.referenceId || data.data?.faceEmbeddingReference;

      if (!reference) {
        throw new AppError(
          500,
          'INVALID_FACE_SERVICE_RESPONSE',
          'Face verification service did not return a valid face reference.'
        );
      }

      return reference;
    } catch (err: any) {
      clearTimeout(timeoutId);

      if (err instanceof AppError) {
        throw err;
      }

      logger.error({ err: err.message, name: err.name }, 'Face verification microservice unreachable during registration');

      throw new AppError(
        503,
        'FACE_SERVICE_UNAVAILABLE',
        'Face verification microservice is unreachable or offline. Please contact the administrator.'
      );
    }
  }

  /**
   * Pre-registration face check: verifies image quality, presence of exactly one face, and liveness
   */
  async checkFace(imageBase64: string): Promise<{ valid: boolean; qualityScore: number; message: string }> {
    if (env.MOCK_FACE_SERVICE) {
      return { valid: true, qualityScore: 0.95, message: 'Face detected clearly.' };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}/api/v1/face/check`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
        },
        body: JSON.stringify({ image: imageBase64 }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorBody: any = await response.json().catch(() => ({}));
        const errDetail = errorBody.detail || errorBody;
        const code = typeof errDetail === 'object' ? errDetail.code : errorBody.code;
        const message = typeof errDetail === 'object' ? errDetail.message : (typeof errDetail === 'string' ? errDetail : errorBody.message);
        throw new AppError(
          response.status || 400,
          code || 'FACE_CHECK_FAILED',
          message || 'Face is not clear or multiple faces detected.'
        );
      }

      const data: any = await response.json();
      return {
        valid: Boolean(data.valid),
        qualityScore: Number(data.qualityScore || 0),
        message: data.message || 'Face detected clearly.',
      };
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err instanceof AppError) throw err;
      throw new AppError(503, 'FACE_SERVICE_UNAVAILABLE', 'Face verification service is currently offline.');
    }
  }

  /**
   * Verifies an incoming biometric capture against the faculty's stored reference embedding
   */
  async verifyFace(
    facultyId: string,
    faceEmbeddingReference: string,
    imageBase64: string,
    challengeToken?: string,
    challengeType?: string,
    frames?: string[]
  ): Promise<FaceVerificationResult> {
    if (env.MOCK_FACE_SERVICE) {
      if (!imageBase64 || imageBase64.length < 20) {
        throw AppError.badRequest('Invalid biometric image payload.', 'INVALID_IMAGE');
      }
      logger.info({ facultyId }, 'Face verified via mock service pipeline (MOCK_FACE_SERVICE=true)');
      return {
        verified: true,
        identityMatched: true,
        similarity: 0.95,
        distance: 0.25,
        confidence: 0.95,
        livenessScore: 0.98,
        isLive: true,
        livenessVerified: true,
        livenessStatus: 'PASSED',
      };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      logger.info({ facultyId, url: `${this.baseUrl}/api/v1/face/verify` }, 'Calling external Face Verification Service for verification');

      const response = await fetch(`${this.baseUrl}/api/v1/face/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
        },
        body: JSON.stringify({
          facultyId,
          faceEmbeddingReference,
          image: imageBase64,
          challengeToken,
          challengeType,
          frames,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorBody: any = await response.json().catch(() => ({}));
        logger.warn({ status: response.status, errorBody }, 'Face service verification returned non-OK status');

        if (response.status >= 500) {
          throw new AppError(
            503,
            'FACE_SERVICE_UNAVAILABLE',
            'Face verification service is currently unavailable or experiencing difficulties.'
          );
        }

        throw new AppError(
          response.status || 400,
          errorBody.code || 'FACE_VERIFICATION_ERROR',
          errorBody.message || 'Face verification failed.'
        );
      }

      const result: any = await response.json();
      const payload = result.data || result;

      return {
        verified: Boolean(payload.verified && payload.identityMatched && payload.livenessVerified),
        identityMatched: Boolean(payload.identityMatched),
        similarity: Number(payload.similarity ?? payload.confidence ?? 0),
        distance: Number(payload.distance ?? 2.0),
        confidence: Number(payload.similarity ?? payload.confidence ?? 0),
        livenessScore: Number(payload.livenessScore ?? 0),
        isLive: Boolean(payload.livenessVerified ?? payload.isLive ?? false),
        livenessVerified: Boolean(payload.livenessVerified),
        livenessStatus: String(payload.livenessStatus || 'NOT_CHECKED'),
        bestFrameIndex: typeof payload.bestFrameIndex === 'number' ? payload.bestFrameIndex : undefined,
        reason: payload.reason,
        errorCode: payload.errorCode || payload.code,
      };
    } catch (err: any) {
      clearTimeout(timeoutId);

      if (err instanceof AppError) {
        throw err;
      }

      logger.error({ err: err.message, name: err.name }, 'Face verification microservice connection failure during verification');

      throw new AppError(
        503,
        'FACE_SERVICE_UNAVAILABLE',
        'Face verification service is currently unavailable. Please verify the Python service is running.'
      );
    }
  }

  /**
   * Validates that a candidate biometric embedding exists and belongs to the specified faculty.
   */
  async validateCandidateEmbedding(
    candidateEmbeddingReference: string,
    expectedEmployeeId: string
  ): Promise<boolean> {
    if (!candidateEmbeddingReference || typeof candidateEmbeddingReference !== 'string') {
      return false;
    }

    const trimmed = candidateEmbeddingReference.trim();
    if (trimmed.length < 5) return false;

    // Check for corrupt or explicitly invalid tokens
    if (trimmed.includes('invalid') || trimmed.includes('corrupt') || trimmed === 'missing') {
      return false;
    }

    if (env.MOCK_FACE_SERVICE) {
      // In mock mode, candidate references follow candidate_*, emb_mock_*, or contain employeeId
      const matchesPattern =
        trimmed.startsWith('candidate_') ||
        trimmed.startsWith('emb_mock_candidate_') ||
        trimmed.startsWith('emb_mock_') ||
        trimmed.startsWith('face_emb_candidate_') ||
        trimmed.includes(expectedEmployeeId);

      logger.info(
        { candidateEmbeddingReference: trimmed, expectedEmployeeId, valid: matchesPattern },
        'Candidate embedding validated via mock pipeline'
      );
      return matchesPattern;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}/api/v1/face/candidate/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
        },
        body: JSON.stringify({
          candidateEmbeddingReference: trimmed,
          facultyId: expectedEmployeeId,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return false;
      }

      const data: any = await response.json();
      return Boolean(data.valid);
    } catch (err: any) {
      clearTimeout(timeoutId);
      logger.warn(
        { err: err.message, candidateEmbeddingReference: trimmed },
        'Candidate embedding verification check failed against face service'
      );
      return false;
    }
  }

  /**
   * Atomically activates a candidate biometric embedding for the faculty member upon admin approval.
   * Promotes the vector into active faculty enrollment and purges the candidate vector.
   * Returns the new active face embedding reference identifier.
   */
  async activateCandidateEmbedding(params: {
    candidateEmbeddingReference: string;
    employeeId: string;
    imageBase64?: string;
  }): Promise<string> {
    const { candidateEmbeddingReference, employeeId, imageBase64 } = params;

    if (env.MOCK_FACE_SERVICE) {
      if (candidateEmbeddingReference.includes('fail_activation')) {
        throw new AppError(
          500,
          'BIOMETRIC_ACTIVATION_FAILED',
          'Simulated microservice failure during candidate embedding activation.'
        );
      }
      const newActiveRef = `face_emb_active_${employeeId}_${Date.now()}`;
      logger.info(
        { employeeId, candidateEmbeddingReference, newActiveRef },
        'Candidate embedding activated via mock pipeline'
      );
      return newActiveRef;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}/api/v1/face/candidate/activate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
        },
        body: JSON.stringify({
          candidateEmbeddingReference,
          facultyId: employeeId,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        // Fallback: If candidate activate endpoint is not yet available, enroll using image if provided
        if (imageBase64) {
          logger.info(
            { employeeId },
            'Candidate activation endpoint unavailable, enrolling fresh active biometric representation'
          );
          return await this.registerFace(employeeId, imageBase64);
        }

        const errorBody: any = await response.json().catch(() => ({}));
        throw new AppError(
          response.status || 500,
          errorBody.code || 'BIOMETRIC_ACTIVATION_FAILED',
          errorBody.message || 'Failed to activate candidate biometric embedding.'
        );
      }

      const data: any = await response.json();
      const activeReference = data.faceEmbeddingReference || data.referenceId;
      if (!activeReference) {
        throw new AppError(
          500,
          'INVALID_FACE_SERVICE_RESPONSE',
          'Face service did not return an active embedding reference after candidate activation.'
        );
      }

      return activeReference;
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err instanceof AppError) throw err;
      logger.error(
        { err: err.message, candidateEmbeddingReference },
        'Microservice connection failure during candidate embedding activation'
      );
      throw new AppError(
        503,
        'FACE_SERVICE_UNAVAILABLE',
        'Face verification microservice is unreachable during biometric activation.'
      );
    }
  }

  /**
   * Safely purges an embedding by reference from the Python microservice storage.
   */
  async cleanupEmbedding(embeddingReference: string): Promise<boolean> {
    if (!embeddingReference || typeof embeddingReference !== 'string') {
      return false;
    }

    if (env.MOCK_FACE_SERVICE) {
      logger.info({ embeddingReference }, 'Embedding cleaned up via mock pipeline');
      return true;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const encoded = encodeURIComponent(embeddingReference);
      const response = await fetch(`${this.baseUrl}/api/v1/face/embedding/${encoded}`, {
        method: 'DELETE',
        headers: {
          'x-api-key': this.apiKey,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch (err: any) {
      clearTimeout(timeoutId);
      logger.warn({ err: err.message, embeddingReference }, 'Failed to cleanup embedding from microservice');
      return false;
    }
  }
}

export const faceVerificationService = new FaceVerificationService();
