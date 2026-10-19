import { Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { AuthenticatedRequest } from '../types';
import { verifyAccessToken } from '../utils/crypto';
import { userRepository } from '../repositories/user.repository';

export async function authenticate(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Check HTTP-only cookie first, then Bearer authorization header
    let token = req.cookies?.access_token;

    if (!token && req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required. Please sign in to continue.',
        },
      });
      return;
    }

    const payload = verifyAccessToken(token);

    // Verify user in database if database connection is active
    if (mongoose.connection.readyState === 1) {
      const user = await userRepository.findById(payload.userId);

      if (!user || !user.isActive) {
        res.status(401).json({
          success: false,
          error: {
            code: 'ACCOUNT_INACTIVE',
            message: 'User account is inactive or no longer exists.',
          },
        });
        return;
      }
    }

    req.user = payload;
    next();
  } catch (err: unknown) {
    res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_TOKEN',
        message: 'Invalid or expired session token.',
      },
    });
  }
}
