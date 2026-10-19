import { Types } from 'mongoose';
import {
  BiometricUpdateRequestModel,
  BiometricUpdateRequestDocument,
} from '../models/BiometricUpdateRequest';
import {
  IBiometricUpdateRequest,
  BiometricUpdateStatus,
  IBiometricUpdateAdminReview,
  IBiometricUpdateJournal,
} from '../types';

export class BiometricUpdateRequestRepository {
  async create(
    data: Partial<IBiometricUpdateRequest>
  ): Promise<BiometricUpdateRequestDocument> {
    return BiometricUpdateRequestModel.create(data);
  }

  async findById(id: string | Types.ObjectId): Promise<BiometricUpdateRequestDocument | null> {
    return BiometricUpdateRequestModel.findById(id).populate('facultyId', 'name email employeeId department');
  }

  async findPendingByFacultyId(
    facultyId: string | Types.ObjectId
  ): Promise<BiometricUpdateRequestDocument | null> {
    const objId = typeof facultyId === 'string' ? new Types.ObjectId(facultyId) : facultyId;
    return BiometricUpdateRequestModel.findOne({
      facultyId: objId,
      status: 'PENDING',
    });
  }

  async findByFacultyId(
    facultyId: string | Types.ObjectId,
    limit = 20
  ): Promise<BiometricUpdateRequestDocument[]> {
    const objId = typeof facultyId === 'string' ? new Types.ObjectId(facultyId) : facultyId;
    return BiometricUpdateRequestModel.find({ facultyId: objId })
      .sort({ createdAt: -1 })
      .limit(limit);
  }

  async findPendingWithPagination(
    page = 1,
    limit = 20
  ): Promise<{ requests: BiometricUpdateRequestDocument[]; total: number }> {
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(50, Math.max(1, limit));
    const skip = (safePage - 1) * safeLimit;

    const [requests, total] = await Promise.all([
      BiometricUpdateRequestModel.find({ status: 'PENDING' })
        .populate('facultyId', 'name email employeeId department')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(safeLimit),
      BiometricUpdateRequestModel.countDocuments({ status: 'PENDING' }),
    ]);

    return { requests, total };
  }

  async updateReview(
    id: string | Types.ObjectId,
    status: BiometricUpdateStatus,
    adminReview: IBiometricUpdateAdminReview
  ): Promise<BiometricUpdateRequestDocument | null> {
    return BiometricUpdateRequestModel.findByIdAndUpdate(
      id,
      {
        status,
        adminReview,
      },
      { new: true }
    );
  }

  /**
   * General paginated query supporting status filtering for administrative overview.
   */
  async findWithPagination(
    filter: { status?: BiometricUpdateStatus } = {},
    page = 1,
    limit = 20
  ): Promise<{ requests: BiometricUpdateRequestDocument[]; total: number }> {
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(50, Math.max(1, limit));
    const skip = (safePage - 1) * safeLimit;

    const query: any = {};
    if (filter.status) {
      query.status = filter.status;
    }

    const [requests, total] = await Promise.all([
      BiometricUpdateRequestModel.find(query)
        .populate('facultyId', 'name email employeeId department')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(safeLimit),
      BiometricUpdateRequestModel.countDocuments(query),
    ]);

    return { requests, total };
  }

  /**
   * Atomically transitions a request from PENDING to APPROVED or REJECTED.
   * Strictly defends against duplicate or concurrent review races.
   */
  async claimAndReview(
    id: string | Types.ObjectId,
    newStatus: 'APPROVED' | 'REJECTED',
    adminReview: IBiometricUpdateAdminReview
  ): Promise<BiometricUpdateRequestDocument | null> {
    const objId = typeof id === 'string' ? new Types.ObjectId(id) : id;
    return BiometricUpdateRequestModel.findOneAndUpdate(
      { _id: objId, status: 'PENDING' },
      {
        $set: {
          status: newStatus,
          adminReview,
          'journal.stage': newStatus === 'APPROVED' ? 'COMPLETED' : 'IDLE',
          'journal.lastAttemptAt': new Date(),
          'journal.recoveryAction': 'NONE',
        },
      },
      { new: true }
    );
  }

  /**
   * Phase 10.6: Atomically acquires exclusive processing lock on a pending request.
   * Prevents concurrent admin review collisions and establishes initial journal checkpoint.
   */
  async claimForApproval(
    id: string | Types.ObjectId,
    previousPhotoRef: string | null = null,
    previousEmbeddingRef: string | null = null
  ): Promise<BiometricUpdateRequestDocument | null> {
    const objId = typeof id === 'string' ? new Types.ObjectId(id) : id;
    return BiometricUpdateRequestModel.findOneAndUpdate(
      {
        _id: objId,
        status: 'PENDING',
        $or: [
          { 'journal.stage': { $in: ['IDLE', 'FAILED', null] } },
          { journal: { $exists: false } },
        ],
      },
      {
        $set: {
          'journal.stage': 'PROCESSING',
          'journal.startedAt': new Date(),
          'journal.lastAttemptAt': new Date(),
          'journal.previousPhotoReference': previousPhotoRef,
          'journal.previousEmbeddingReference': previousEmbeddingRef,
          'journal.errorMessage': null,
          'journal.recoveryAction': 'NONE',
        },
      },
      { new: true }
    );
  }

  /**
   * Phase 10.6: Updates the journal state machine checkpoint during multi-system distribution.
   */
  async updateJournal(
    id: string | Types.ObjectId,
    updates: Partial<IBiometricUpdateJournal>
  ): Promise<BiometricUpdateRequestDocument | null> {
    const objId = typeof id === 'string' ? new Types.ObjectId(id) : id;
    const setFields: Record<string, any> = {
      'journal.lastAttemptAt': new Date(),
    };
    for (const [key, val] of Object.entries(updates)) {
      setFields[`journal.${key}`] = val;
    }
    return BiometricUpdateRequestModel.findByIdAndUpdate(
      objId,
      { $set: setFields },
      { new: true }
    );
  }

  /**
   * Phase 10.6: Atomically completes approval and records review decisions once user is safely committed.
   */
  async finalizeApproval(
    id: string | Types.ObjectId,
    adminReview: IBiometricUpdateAdminReview
  ): Promise<BiometricUpdateRequestDocument | null> {
    const objId = typeof id === 'string' ? new Types.ObjectId(id) : id;
    return BiometricUpdateRequestModel.findByIdAndUpdate(
      objId,
      {
        $set: {
          status: 'APPROVED',
          adminReview,
          'journal.stage': 'COMPLETED',
          'journal.lastAttemptAt': new Date(),
          'journal.recoveryAction': 'NONE',
          'journal.errorMessage': null,
        },
      },
      { new: true }
    );
  }

  /**
   * Phase 10.6: Safely resets journal state after a recoverable failure or rollback.
   */
  async resetToPending(
    id: string | Types.ObjectId,
    options: {
      stage?: 'IDLE' | 'FAILED';
      errorMessage?: string | null;
      recoveryAction?: 'RETRY' | 'ROLLBACK' | 'REQUIRES_INTERVENTION' | 'NONE';
      clearPromotedReferences?: boolean;
    } = {}
  ): Promise<BiometricUpdateRequestDocument | null> {
    const objId = typeof id === 'string' ? new Types.ObjectId(id) : id;
    const setFields: Record<string, any> = {
      'journal.stage': options.stage || 'IDLE',
      'journal.lastAttemptAt': new Date(),
      'journal.errorMessage': options.errorMessage ?? null,
      'journal.recoveryAction': options.recoveryAction ?? 'NONE',
    };
    if (options.clearPromotedReferences) {
      setFields['journal.promotedPhotoReference'] = null;
      setFields['journal.newEmbeddingReference'] = null;
    }
    return BiometricUpdateRequestModel.findByIdAndUpdate(
      objId,
      { $set: setFields },
      { new: true }
    );
  }

  /**
   * Phase 10.6: Finds requests with interrupted or incomplete journal state for reconciliation.
   */
  async findIncompleteRequests(): Promise<BiometricUpdateRequestDocument[]> {
    return BiometricUpdateRequestModel.find({
      status: 'PENDING',
      'journal.stage': {
        $in: ['PROCESSING', 'PHOTO_PROMOTED', 'EMBEDDING_ACTIVATED', 'USER_COMMITTED', 'FAILED'],
      },
    }).populate('facultyId', 'name email employeeId department profilePhotoReference faceEmbeddingReference');
  }

  async countPending(): Promise<number> {
    return BiometricUpdateRequestModel.countDocuments({ status: 'PENDING' });
  }
}

export const biometricUpdateRequestRepository = new BiometricUpdateRequestRepository();
