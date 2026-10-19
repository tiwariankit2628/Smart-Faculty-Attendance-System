import mongoose from 'mongoose';
import { NotificationModel, NotificationDocument } from '../models/Notification';
import { INotification } from '../types';

export class NotificationRepository {
  async create(data: Partial<INotification>): Promise<NotificationDocument> {
    return NotificationModel.create(data);
  }

  async findByFacultyId(
    facultyId: string,
    page = 1,
    limit = 20
  ): Promise<{ notifications: NotificationDocument[]; total: number }> {
    const query = { facultyId: new mongoose.Types.ObjectId(facultyId) };
    const skip = (page - 1) * limit;

    const [notifications, total] = await Promise.all([
      NotificationModel.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      NotificationModel.countDocuments(query),
    ]);

    return { notifications, total };
  }

  async countUnreadByFacultyId(facultyId: string): Promise<number> {
    return NotificationModel.countDocuments({
      facultyId: new mongoose.Types.ObjectId(facultyId),
      read: false,
    });
  }

  async findByIdAndFacultyId(
    id: string,
    facultyId: string
  ): Promise<NotificationDocument | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    return NotificationModel.findOne({
      _id: new mongoose.Types.ObjectId(id),
      facultyId: new mongoose.Types.ObjectId(facultyId),
    });
  }

  async markAsRead(
    id: string,
    facultyId: string
  ): Promise<NotificationDocument | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    return NotificationModel.findOneAndUpdate(
      {
        _id: new mongoose.Types.ObjectId(id),
        facultyId: new mongoose.Types.ObjectId(facultyId),
      },
      {
        $set: {
          read: true,
          readAt: new Date(),
        },
      },
      { new: true }
    );
  }

  async markAllAsRead(facultyId: string): Promise<number> {
    const result = await NotificationModel.updateMany(
      {
        facultyId: new mongoose.Types.ObjectId(facultyId),
        read: false,
      },
      {
        $set: {
          read: true,
          readAt: new Date(),
        },
      }
    );
    return result.modifiedCount;
  }

  async findByDeduplicationKey(deduplicationKey: string): Promise<NotificationDocument | null> {
    return NotificationModel.findOne({ deduplicationKey });
  }

  async findExistingForAttendanceAndStatus(
    attendanceId: string,
    type: string
  ): Promise<NotificationDocument | null> {
    return NotificationModel.findOne({
      attendanceId: new mongoose.Types.ObjectId(attendanceId),
      type,
    }).sort({ createdAt: -1 });
  }
}

export const notificationRepository = new NotificationRepository();
