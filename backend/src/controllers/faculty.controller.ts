import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types';
import { facultyService } from '../services/faculty.service';
import { notificationService } from '../services/notification.service';
import { sendSuccess } from '../utils/apiResponse';

export class FacultyController {
  async getProfile(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const profile = await facultyService.getProfile(req.user!.userId);
      sendSuccess(res, { profile }, 200);
    } catch (error) {
      next(error);
    }
  }

  async getAttendance(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 60;
      const history = await facultyService.getAttendanceHistory(req.user!.userId, limit);
      sendSuccess(res, history, 200);
    } catch (error) {
      next(error);
    }
  }

  async registerFace(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await facultyService.registerFace(
        req.user!.userId,
        req.body.image,
        req.requestId
      );
      sendSuccess(res, result, 200);
    } catch (error) {
      next(error);
    }
  }

  async createBiometricUpdateRequest(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await facultyService.createBiometricUpdateRequest(
        req.user!.userId,
        req.body,
        req.requestId
      );
      sendSuccess(res, result, 201);
    } catch (error) {
      next(error);
    }
  }

  async getBiometricUpdateRequests(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await facultyService.getBiometricUpdateRequests(req.user!.userId);
      sendSuccess(res, result, 200);
    } catch (error) {
      next(error);
    }
  }

  async getNotifications(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
      const result = await notificationService.getFacultyNotifications(req.user!.userId, page, limit);
      sendSuccess(res, result, 200);
    } catch (error) {
      next(error);
    }
  }

  async getUnreadCount(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await notificationService.getUnreadCount(req.user!.userId);
      sendSuccess(res, result, 200);
    } catch (error) {
      next(error);
    }
  }

  async markNotificationAsRead(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const result = await notificationService.markAsRead(id, req.user!.userId);
      sendSuccess(res, { notification: result }, 200);
    } catch (error) {
      next(error);
    }
  }

  async markAllNotificationsAsRead(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await notificationService.markAllAsRead(req.user!.userId);
      sendSuccess(res, result, 200);
    } catch (error) {
      next(error);
    }
  }
}

export const facultyController = new FacultyController();
