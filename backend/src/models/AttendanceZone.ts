import mongoose, { Schema, Document } from 'mongoose';
import { IAttendanceZone } from '../types';

export type AttendanceZoneDocument = IAttendanceZone & Document;

const AttendanceZoneSchema = new Schema<AttendanceZoneDocument>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    latitude: {
      type: Number,
      required: true,
    },
    longitude: {
      type: Number,
      required: true,
    },
    radiusMeters: {
      type: Number,
      required: true,
      min: 10,
    },
    maxAllowedAccuracyMeters: {
      type: Number,
      default: 35,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
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

export const AttendanceZoneModel = mongoose.model<AttendanceZoneDocument>(
  'AttendanceZone',
  AttendanceZoneSchema
);
