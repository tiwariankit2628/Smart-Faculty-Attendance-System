import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types';
import { adminService } from '../services/admin.service';
import { sendSuccess } from '../utils/apiResponse';

export class AdminController {
  async createFaculty(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const faculty = await adminService.createFaculty(req.body, req.user!.userId, req.requestId);
      sendSuccess(res, { faculty }, 201);
    } catch (error) {
      next(error);
    }
  }

  async getDashboardStats(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const stats = await adminService.getDashboardStats(req.query as any);
      sendSuccess(res, stats, 200);
    } catch (error) {
      next(error);
    }
  }

  async getAllFaculty(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await adminService.getAllFaculty(req.query as any);
      sendSuccess(res, result, 200);
    } catch (error) {
      next(error);
    }
  }

  async getFacultyDetail(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const detail = await adminService.getFacultyDetail(id);
      sendSuccess(res, detail, 200);
    } catch (error) {
      next(error);
    }
  }

  async updateFaculty(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const updated = await adminService.updateFaculty(
        id,
        req.body,
        req.user!.userId,
        req.requestId
      );
      sendSuccess(res, { faculty: updated }, 200);
    } catch (error) {
      next(error);
    }
  }

  async deleteFaculty(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const result = await adminService.deleteFaculty(
        id,
        req.user!.userId,
        req.requestId
      );
      sendSuccess(res, result, 200);
    } catch (error) {
      next(error);
    }
  }

  async getAttendance(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { date, facultyId, status, limit } = req.query;
      const records = await adminService.getAttendance({
        date: date as string,
        facultyId: facultyId as string,
        status: status as string,
        limit: limit ? parseInt(limit as string, 10) : 100,
      });
      sendSuccess(res, { records }, 200);
    } catch (error) {
      next(error);
    }
  }

  async getAttendanceDetail(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const detail = await adminService.getAttendanceDetail(id, req.user!.userId, req.requestId);
      sendSuccess(res, { detail }, 200);
    } catch (error) {
      next(error);
    }
  }

  async getReviewQueue(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await adminService.getReviewQueue(req.query as any);
      sendSuccess(res, result, 200);
    } catch (error) {
      next(error);
    }
  }

  async overrideAttendance(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const record = await adminService.overrideAttendance(
        id,
        req.body,
        req.user!.userId,
        req.user!.name || 'Administrator',
        req.requestId
      );
      sendSuccess(res, { record }, 200);
    } catch (error) {
      next(error);
    }
  }

  async getAuditLogs(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await adminService.getAuditLogs(req.query as any);
      sendSuccess(res, result, 200);
    } catch (error) {
      next(error);
    }
  }

  async getAttendanceZone(_req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const zone = await adminService.getAttendanceZone();
      sendSuccess(res, { zone }, 200);
    } catch (error) {
      next(error);
    }
  }

  async updateAttendanceZone(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const zone = await adminService.updateAttendanceZone(
        req.body,
        req.user!.userId,
        req.requestId
      );
      sendSuccess(res, { zone }, 200);
    } catch (error) {
      next(error);
    }
  }

  async resetFacultyFace(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const result = await adminService.resetFacultyFace(
        id,
        req.user!.userId,
        req.body?.reason,
        req.requestId
      );
      sendSuccess(res, result, 200);
    } catch (error) {
      next(error);
    }
  }

  async getAttendanceEvidence(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const evidence = await adminService.getAttendanceEvidence(
        id,
        req.user!.userId,
        req.requestId
      );

      res.setHeader('Content-Type', evidence.contentType);
      res.setHeader('Content-Length', evidence.size);
      res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
      res.setHeader('Content-Disposition', 'inline; filename="verification-snapshot.jpg"');
      res.status(200).send(evidence.buffer);
    } catch (error) {
      next(error);
    }
  }

  async cleanupExpiredEvidence(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await adminService.cleanupExpiredEvidence(
        req.user!.userId,
        req.requestId
      );
      sendSuccess(res, result, 200);
    } catch (error) {
      next(error);
    }
  }

  async getBiometricUpdateRequests(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await adminService.getBiometricUpdateRequests(req.query as any);
      sendSuccess(res, result, 200);
    } catch (error) {
      next(error);
    }
  }

  async getBiometricUpdateRequestDetail(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const result = await adminService.getBiometricUpdateRequestDetail(id);
      sendSuccess(res, result, 200);
    } catch (error) {
      next(error);
    }
  }

  async getBiometricUpdateRequestCandidatePhoto(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const photo = await adminService.getBiometricUpdateRequestCandidatePhoto(
        id,
        req.user!.userId,
        req.requestId
      );

      res.setHeader('Content-Type', photo.contentType);
      res.setHeader('Content-Length', photo.size);
      res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
      res.setHeader('Content-Disposition', 'inline; filename="candidate-biometric-photo.jpg"');
      res.status(200).send(photo.buffer);
    } catch (error) {
      next(error);
    }
  }

  async approveBiometricUpdateRequest(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const result = await adminService.approveBiometricUpdateRequest(
        id,
        req.body,
        {
          userId: req.user!.userId,
          name: req.user!.name || 'Administrator',
        },
        req.requestId
      );
      sendSuccess(res, result, 200);
    } catch (error) {
      next(error);
    }
  }

  async rejectBiometricUpdateRequest(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const result = await adminService.rejectBiometricUpdateRequest(
        id,
        req.body,
        {
          userId: req.user!.userId,
          name: req.user!.name || 'Administrator',
        },
        req.requestId
      );
      sendSuccess(res, result, 200);
    } catch (error) {
      next(error);
    }
  }
}

export const adminController = new AdminController();
