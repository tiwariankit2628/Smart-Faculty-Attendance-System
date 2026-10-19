import mongoose, { Schema, Document } from 'mongoose';
import { INotification, NotificationType } from '../types';

export type NotificationDocument = INotification & Document;

const NotificationSchema = new Schema<NotificationDocument>(
  {
    facultyId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    attendanceId: {
      type: Schema.Types.ObjectId,
      ref: 'Attendance',
      required: false,
      index: true,
    },
    biometricRequestId: {
      type: Schema.Types.ObjectId,
      ref: 'BiometricUpdateRequest',
      required: false,
      index: true,
    },
    type: {
      type: String,
      enum: [
        'ATTENDANCE_APPROVED',
        'ATTENDANCE_REJECTED',
        'ATTENDANCE_REVIEW_REQUIRED',
        'BIOMETRIC_UPDATE_APPROVED',
        'BIOMETRIC_UPDATE_REJECTED',
      ],
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    read: {
      type: Boolean,
      default: false,
      index: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    readAt: {
      type: Date,
      default: null,
    },
    deduplicationKey: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
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

// Performance & Filtering Indexes
// 1. Faculty personal notification feed sorted by creation date descending
NotificationSchema.index({ facultyId: 1, createdAt: -1 });

// 2. Unread notification queries
NotificationSchema.index({ facultyId: 1, read: 1 });

export const NotificationModel = mongoose.model<NotificationDocument>('Notification', NotificationSchema);
