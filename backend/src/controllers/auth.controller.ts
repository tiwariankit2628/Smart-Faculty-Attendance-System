import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types';
import { authService } from '../services/auth.service';
import { sendSuccess } from '../utils/apiResponse';
import { env } from '../config/env';

// 15 minutes cookie expiry matching JWT lifetime
const COOKIE_MAX_AGE_MS = 15 * 60 * 1000;

export class AuthController {
  async checkFace(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await authService.checkFace(req.body.image);
      sendSuccess(res, result, 200);
    } catch (error) {
      next(error);
    }
  }

  async register(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await authService.register(req.body, {
        ip: req.ip,
        userAgent: req.get('user-agent'),
        requestId: req.requestId,
      });

      // Set secure HTTP-only cookie
      res.cookie('access_token', result.token, {
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: COOKIE_MAX_AGE_MS,
        path: '/',
      });

      sendSuccess(res, result, 201);
    } catch (error) {
      next(error);
    }
  }

  async login(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await authService.login(req.body, {
        ip: req.ip,
        userAgent: req.get('user-agent'),
        requestId: req.requestId,
      });

      // Set secure HTTP-only cookie
      res.cookie('access_token', result.token, {
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: COOKIE_MAX_AGE_MS,
        path: '/',
      });

      sendSuccess(res, result, 200);
    } catch (error) {
      next(error);
    }
  }

  async forgotPassword(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await authService.forgotPassword(req.body, {
        ip: req.ip,
        userAgent: req.get('user-agent'),
        requestId: req.requestId,
      });
      sendSuccess(res, result, 200);
    } catch (error) {
      next(error);
    }
  }

  async resetPassword(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await authService.resetPassword(req.body, {
        ip: req.ip,
        userAgent: req.get('user-agent'),
        requestId: req.requestId,
      });
      sendSuccess(res, result, 200);
    } catch (error) {
      next(error);
    }
  }

  async logout(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId || 'anonymous';
      const result = await authService.logout(userId, {
        ip: req.ip,
        userAgent: req.get('user-agent'),
        requestId: req.requestId,
      });

      res.clearCookie('access_token', {
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
      });

      sendSuccess(res, result, 200);
    } catch (error) {
      next(error);
    }
  }

  async getMe(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await authService.getMe(req.user!.userId);
      sendSuccess(res, { user }, 200);
    } catch (error) {
      next(error);
    }
  }
}

export const authController = new AuthController();
