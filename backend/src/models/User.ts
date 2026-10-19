import mongoose, { Schema, Document } from 'mongoose';
import { IUser } from '../types';

export type UserDocument = IUser & Document;

const UserSchema = new Schema<UserDocument>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    employeeId: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ['FACULTY', 'ADMIN'],
      default: 'FACULTY',
      required: true,
      index: true,
    },
    department: {
      type: String,
      required: true,
      trim: true,
    },
    faceEmbeddingReference: {
      type: String,
      default: null,
    },
    profilePhotoReference: {
      type: String,
      default: null,
    },
    photoUpdatedAt: {
      type: Date,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    deletedAt: {
      type: Date,
      default: null,
      index: true,
    },
    passwordResetToken: {
      type: String,
      default: null,
    },
    passwordResetExpires: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: {
      transform(_doc, ret: any) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.passwordHash;
        delete ret.passwordResetToken;
        delete ret.passwordResetExpires;
        ret.faceEnrolled = Boolean(ret.faceEmbeddingReference);
        ret.isFaceEnrolled = Boolean(ret.faceEmbeddingReference);
        ret.profilePhotoReference = ret.profilePhotoReference || null;
        ret.photoUpdatedAt = ret.photoUpdatedAt || null;
        ret.hasProfilePhoto = Boolean(ret.profilePhotoReference);
        return ret;
      },
    },
  }
);

UserSchema.index({ role: 1, deletedAt: 1, createdAt: -1 });
UserSchema.index({ department: 1, isActive: 1 });

export const UserModel = mongoose.model<UserDocument>('User', UserSchema);
