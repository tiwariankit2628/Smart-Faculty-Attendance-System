import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types';
import { attendanceService } from '../services/attendance.service';
import { sendSuccess } from '../utils/apiResponse';

export class AttendanceController {
  async createChallenge(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await attendanceService.createLivenessChallenge(req.user!.userId);
      sendSuccess(res, result, 201);
    } catch (error) {
      next(error);
    }
  }

  async verifyLocation(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await attendanceService.verifyLocation(req.user!.userId, req.body, req.ip);
      sendSuccess(res, result, 200);
    } catch (error) {
      next(error);
    }
  }

  async verifyFace(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await attendanceService.verifyFace(req.user!.userId, req.body);
      sendSuccess(res, result, 200);
    } catch (error) {
      next(error);
    }
  }

  async markAttendance(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await attendanceService.markAttendance(req.user!.userId, req.body, {
        ip: req.ip,
        userAgent: req.get('user-agent'),
        requestId: req.requestId,
      });
      sendSuccess(res, result, 201);
    } catch (error) {
      next(error);
    }
  }

  async getToday(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const record = await attendanceService.getTodayAttendance(req.user!.userId);
      sendSuccess(res, { attendance: record }, 200);
    } catch (error) {
      next(error);
    }
  }

  async getHistory(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 30;
      const records = await attendanceService.getAttendanceHistory(req.user!.userId, limit);
      sendSuccess(res, { records }, 200);
    } catch (error) {
      next(error);
    }
  }
}

export const attendanceController = new AttendanceController();
