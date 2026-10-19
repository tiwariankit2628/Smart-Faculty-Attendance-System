import { AttendanceModel, AttendanceDocument } from '../models/Attendance';
import { IAttendance } from '../types';

export class AttendanceRepository {
  async findById(id: string): Promise<AttendanceDocument | null> {
    return AttendanceModel.findById(id).populate('facultyId', 'name email employeeId department isActive');
  }

  async findByFacultyAndDate(facultyId: string, date: string): Promise<AttendanceDocument | null> {
    return AttendanceModel.findOne({ facultyId, date });
  }

  async create(data: Partial<IAttendance>): Promise<AttendanceDocument> {
    return AttendanceModel.create(data);
  }

  async findByFacultyId(facultyId: string, limit = 50): Promise<AttendanceDocument[]> {
    return AttendanceModel.find({ facultyId }).sort({ timestamp: -1 }).limit(limit);
  }

  async findAll(filter: Record<string, unknown> = {}, limit = 100): Promise<AttendanceDocument[]> {
    return AttendanceModel.find(filter)
      .populate('facultyId', 'name email employeeId department isActive')
      .sort({ timestamp: -1 })
      .limit(limit);
  }

  async countVerifiedToday(date: string): Promise<number> {
    return AttendanceModel.countDocuments({ date, status: 'VERIFIED' });
  }

  async countDocuments(filter: Record<string, unknown> = {}): Promise<number> {
    return AttendanceModel.countDocuments(filter);
  }

  async findWithPagination(
    filter: Record<string, unknown> = {},
    page = 1,
    limit = 15
  ): Promise<{ records: AttendanceDocument[]; total: number }> {
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(50, Math.max(1, limit));
    const skip = (safePage - 1) * safeLimit;

    const [records, total] = await Promise.all([
      AttendanceModel.find(filter)
        .populate('facultyId', 'name email employeeId department isActive')
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(safeLimit),
      AttendanceModel.countDocuments(filter),
    ]);

    return { records, total };
  }
}

export const attendanceRepository = new AttendanceRepository();
