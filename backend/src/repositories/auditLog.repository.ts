import { AuditLogModel, AuditLogDocument } from '../models/AuditLog';
import { IAuditLog } from '../types';

export class AuditLogRepository {
  async create(data: Partial<IAuditLog>): Promise<AuditLogDocument> {
    return AuditLogModel.create(data);
  }

  async findAll(limit = 100): Promise<AuditLogDocument[]> {
    return AuditLogModel.find().sort({ timestamp: -1 }).limit(limit);
  }

  async findByAttendanceId(attendanceId: string): Promise<AuditLogDocument[]> {
    return AuditLogModel.find({
      'metadata.attendanceId': attendanceId,
    }).sort({ timestamp: 1 });
  }

  async countDocuments(filter: Record<string, unknown> = {}): Promise<number> {
    return AuditLogModel.countDocuments(filter);
  }

  async findWithPagination(
    filter: Record<string, unknown> = {},
    page = 1,
    limit = 20
  ): Promise<{ logs: AuditLogDocument[]; total: number }> {
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(50, Math.max(1, limit));
    const skip = (safePage - 1) * safeLimit;

    const [logs, total] = await Promise.all([
      AuditLogModel.find(filter)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(safeLimit),
      AuditLogModel.countDocuments(filter),
    ]);

    return { logs, total };
  }
}

export const auditLogRepository = new AuditLogRepository();
