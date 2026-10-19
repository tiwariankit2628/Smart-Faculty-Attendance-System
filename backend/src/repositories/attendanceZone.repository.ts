import { AttendanceZoneModel, AttendanceZoneDocument } from '../models/AttendanceZone';
import { IAttendanceZone } from '../types';

export class AttendanceZoneRepository {
  async getActiveZone(): Promise<AttendanceZoneDocument | null> {
    return AttendanceZoneModel.findOne({ isActive: true });
  }

  async findAll(): Promise<AttendanceZoneDocument[]> {
    return AttendanceZoneModel.find().sort({ createdAt: -1 });
  }

  async findById(id: string): Promise<AttendanceZoneDocument | null> {
    return AttendanceZoneModel.findById(id);
  }

  async create(data: Partial<IAttendanceZone>): Promise<AttendanceZoneDocument> {
    return AttendanceZoneModel.create(data);
  }

  async update(id: string, updates: Partial<IAttendanceZone>): Promise<AttendanceZoneDocument | null> {
    return AttendanceZoneModel.findByIdAndUpdate(id, updates, { new: true });
  }
}

export const attendanceZoneRepository = new AttendanceZoneRepository();
