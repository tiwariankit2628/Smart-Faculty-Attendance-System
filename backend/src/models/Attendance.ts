import mongoose, { Schema, Document } from 'mongoose';
import { IAttendance } from '../types';

export type AttendanceDocument = IAttendance & Document;

const AttendanceSchema = new Schema<AttendanceDocument>(
  {
    facultyId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    date: {
      type: String, // YYYY-MM-DD format
      required: true,
      index: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      required: true,
    },
    latitude: {
      type: Number,
      required: true,
    },
    longitude: {
      type: Number,
      required: true,
    },
    distanceFromZone: {
      type: Number,
      required: true,
    },
    locationVerified: {
      type: Boolean,
      required: true,
    },
    faceVerified: {
      type: Boolean,
      required: true,
    },
    livenessVerified: {
      type: Boolean,
      required: true,
    },
    status: {
      type: String,
      enum: ['VERIFIED', 'REJECTED', 'FLAGGED'],
      required: true,
      index: true,
    },
    originalStatus: {
      type: String,
      enum: ['VERIFIED', 'REJECTED', 'FLAGGED'],
      required: false,
    },
    manualOverride: {
      adminId: { type: Schema.Types.ObjectId, ref: 'User' },
      adminName: { type: String },
      previousStatus: { type: String, enum: ['VERIFIED', 'REJECTED', 'FLAGGED'] },
      newStatus: { type: String, enum: ['VERIFIED', 'REJECTED', 'FLAGGED'] },
      reason: { type: String },
      timestamp: { type: Date },
    },
    verificationEvidence: {
      type: new Schema(
        {
          reference: { type: String, index: true },
          capturedAt: { type: Date },
          contentType: { type: String, default: 'image/jpeg' },
          size: { type: Number },
          retentionUntil: { type: Date, index: true },
        },
        { _id: false }
      ),
      default: undefined,
    },
    verificationMetadata: {
      faceConfidence: { type: Number },
      livenessScore: { type: Number },
      accuracyMeters: { type: Number },
      zoneId: { type: String },
      zoneName: { type: String },
      ipAddress: { type: String },
      userAgent: { type: String },
      challengeToken: { type: String },
      rejectionReason: { type: String },
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

// Database constraint: Enforce one attendance record per faculty per date at the database engine level
AttendanceSchema.index({ facultyId: 1, date: 1 }, { unique: true });

// Performance index: Admin dashboard queries filtering by date and status, sorted by timestamp
AttendanceSchema.index({ date: 1, status: 1, timestamp: -1 });

// Performance index: Faculty personal history queries sorted by timestamp
AttendanceSchema.index({ facultyId: 1, timestamp: -1 });

// Performance index: Needs Review Queue queries filtering by non-overridden flagged/rejected status
AttendanceSchema.index({ status: 1, 'manualOverride.adminId': 1, timestamp: -1 });

export const AttendanceModel = mongoose.model<AttendanceDocument>('Attendance', AttendanceSchema);
