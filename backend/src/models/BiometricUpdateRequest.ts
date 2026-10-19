import mongoose, { Schema, Document } from 'mongoose';
import { IBiometricUpdateRequest } from '../types';

export type BiometricUpdateRequestDocument = IBiometricUpdateRequest & Document;

const AdminReviewSchema = new Schema(
  {
    adminId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    adminName: {
      type: String,
      trim: true,
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    notes: {
      type: String,
      trim: true,
      default: null,
    },
  },
  { _id: false }
);

const BiometricUpdateJournalSchema = new Schema(
  {
    stage: {
      type: String,
      enum: [
        'IDLE',
        'PROCESSING',
        'PHOTO_PROMOTED',
        'EMBEDDING_ACTIVATED',
        'USER_COMMITTED',
        'COMPLETED',
        'FAILED',
      ],
      default: 'IDLE',
      required: true,
      index: true,
    },
    promotedPhotoReference: {
      type: String,
      default: null,
    },
    newEmbeddingReference: {
      type: String,
      default: null,
    },
    previousPhotoReference: {
      type: String,
      default: null,
    },
    previousEmbeddingReference: {
      type: String,
      default: null,
    },
    startedAt: {
      type: Date,
      default: null,
    },
    lastAttemptAt: {
      type: Date,
      default: null,
    },
    errorMessage: {
      type: String,
      default: null,
    },
    recoveryAction: {
      type: String,
      enum: ['RETRY', 'ROLLBACK', 'REQUIRES_INTERVENTION', 'NONE'],
      default: 'NONE',
    },
  },
  { _id: false }
);

const BiometricUpdateRequestSchema = new Schema<BiometricUpdateRequestDocument>(
  {
    facultyId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    employeeId: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    candidatePhotoReference: {
      type: String,
      required: true,
      trim: true,
    },
    candidateEmbeddingReference: {
      type: String,
      required: true,
      trim: true,
    },
    reason: {
      type: String,
      trim: true,
      default: '',
    },
    status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED'],
      default: 'PENDING',
      required: true,
      index: true,
    },
    adminReview: {
      type: AdminReviewSchema,
      default: null,
    },
    journal: {
      type: BiometricUpdateJournalSchema,
      default: () => ({ stage: 'IDLE', recoveryAction: 'NONE' }),
    },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: {
      transform(_doc, ret: any) {
        ret.id = ret._id;
        delete ret._id;
        return ret;
      },
    },
  }
);

// Indexes
// 1. Efficient administrative pending requests retrieval
BiometricUpdateRequestSchema.index({ status: 1, createdAt: -1 });

// 2. Faculty chronological history lookup
BiometricUpdateRequestSchema.index({ facultyId: 1, createdAt: -1 });

// 3. CRITICAL SAFETY MECHANISM: Prevent duplicate pending requests for the same faculty member
BiometricUpdateRequestSchema.index(
  { facultyId: 1 },
  {
    name: 'unique_pending_faculty_request',
    unique: true,
    partialFilterExpression: { status: 'PENDING' },
  }
);

export const BiometricUpdateRequestModel = mongoose.model<BiometricUpdateRequestDocument>(
  'BiometricUpdateRequest',
  BiometricUpdateRequestSchema
);
