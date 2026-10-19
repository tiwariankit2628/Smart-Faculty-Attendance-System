import { userRepository } from '../repositories/user.repository';
import { comparePassword, hashPassword, generateAccessToken } from '../utils/crypto';
import { AppError } from '../utils/apiError';
import { auditService } from './audit.service';
import { faceVerificationService } from './faceVerification.service';
import { logger } from '../utils/logger';
import {
  LoginInput,
  RegisterInput,
  ForgotPasswordInput,
  ResetPasswordInput,
} from '../validators/auth.validator';
import { JwtPayload } from '../types';

export class AuthService {
  /**
   * Pre-registration face quality and single-face check
   */
  async checkFace(imageBase64: string) {
    return faceVerificationService.checkFace(imageBase64);
  }

  /**
   * Self-service registration for new faculty members
   */
  async register(
    input: RegisterInput,
    meta?: { ip?: string; userAgent?: string; requestId?: string }
  ) {
    const normalizedEmail = input.email.toLowerCase().trim();
    const normalizedEmpId = input.employeeId.toUpperCase().trim();

    // 1. Verify unique email
    const existingEmail = await userRepository.findByEmail(normalizedEmail);
    if (existingEmail) {
      throw AppError.conflict(
        'A faculty account with this official email already exists.',
        'EMAIL_ALREADY_EXISTS'
      );
    }

    // 2. Verify unique employee / faculty ID
    const existingEmpId = await userRepository.findByEmployeeId(normalizedEmpId);
    if (existingEmpId) {
      throw AppError.conflict(
        'A faculty account with this Faculty ID already exists.',
        'FACULTY_ID_ALREADY_EXISTS'
      );
    }

    // 3. Register facial biometrics if face image is supplied
    let faceReference: string | null = null;
    const faceImage = input.image || input.faceImage;
    if (faceImage) {
      faceReference = await faceVerificationService.registerFace(normalizedEmpId, faceImage);
    }

    // 4. Hash password securely
    const passwordHash = await hashPassword(input.password);

    // 5. Create new faculty user in database
    const newUser = await userRepository.create({
      name: input.name.trim(),
      email: normalizedEmail,
      employeeId: normalizedEmpId,
      passwordHash,
      role: 'FACULTY',
      department: input.department.trim(),
      faceEmbeddingReference: faceReference,
      isActive: true,
    });

    const tokenPayload: JwtPayload = {
      userId: newUser._id.toString(),
      email: newUser.email,
      role: newUser.role,
      employeeId: newUser.employeeId,
      name: newUser.name,
    };

    const token = generateAccessToken(tokenPayload);

    await auditService.logAction(
      newUser._id.toString(),
      'AUTH_REGISTER_SUCCESS',
      meta?.requestId,
      {
        ip: meta?.ip,
        userAgent: meta?.userAgent,
        employeeId: newUser.employeeId,
        department: newUser.department,
      }
    );

    return {
      user: newUser.toJSON(),
      token,
      message: 'Faculty account registered successfully.',
    };
  }

  async login(
    input: LoginInput,
    meta?: { ip?: string; userAgent?: string; requestId?: string }
  ) {
    const user = await userRepository.findByEmail(input.email);

    if (!user) {
      throw AppError.unauthorized('Invalid email or password provided.', 'INVALID_CREDENTIALS');
    }

    if (!user.isActive) {
      throw AppError.unauthorized(
        'Your account has been deactivated. Please contact the administrator.',
        'ACCOUNT_DEACTIVATED'
      );
    }

    const isMatch = await comparePassword(input.password, user.passwordHash);
    if (!isMatch) {
      await auditService.logAction(
        user._id.toString(),
        'AUTH_LOGIN_FAILED',
        meta?.requestId,
        { ip: meta?.ip, userAgent: meta?.userAgent, reason: 'Incorrect password' }
      );
      throw AppError.unauthorized('Invalid email or password provided.', 'INVALID_CREDENTIALS');
    }

    const tokenPayload: JwtPayload = {
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
      employeeId: user.employeeId,
      name: user.name,
    };

    const token = generateAccessToken(tokenPayload);

    await auditService.logAction(
      user._id.toString(),
      'AUTH_LOGIN_SUCCESS',
      meta?.requestId,
      { ip: meta?.ip, userAgent: meta?.userAgent }
    );

    const safeUser = user.toJSON();

    return {
      user: safeUser,
      token,
    };
  }

  /**
   * Request password reset code
   */
  async forgotPassword(
    input: ForgotPasswordInput,
    meta?: { ip?: string; userAgent?: string; requestId?: string }
  ) {
    const normalizedEmail = input.email.toLowerCase().trim();
    const user = await userRepository.findByEmail(normalizedEmail);

    if (!user) {
      return {
        message: 'If this official email is registered, a password reset code has been generated.',
      };
    }

    if (!user.isActive) {
      throw AppError.forbidden(
        'This account is deactivated. Please contact the administrator.',
        'ACCOUNT_DEACTIVATED'
      );
    }

    // Generate 6-digit numeric verification code
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes validity

    user.passwordResetToken = resetCode;
    user.passwordResetExpires = expiry;
    await user.save();

    logger.info(
      { email: user.email, resetCode, employeeId: user.employeeId },
      'Generated password reset code for faculty account'
    );

    await auditService.logAction(
      user._id.toString(),
      'AUTH_FORGOT_PASSWORD_REQUESTED',
      meta?.requestId,
      { ip: meta?.ip, userAgent: meta?.userAgent }
    );

    return {
      message: 'Password reset code generated. Please enter the code and your new password.',
      resetToken: resetCode, // Returned for frictionless local evaluation
    };
  }

  /**
   * Reset password using verification code
   */
  async resetPassword(
    input: ResetPasswordInput,
    meta?: { ip?: string; userAgent?: string; requestId?: string }
  ) {
    const normalizedEmail = input.email.toLowerCase().trim();
    const user = await userRepository.findByEmail(normalizedEmail);

    if (!user) {
      throw AppError.badRequest(
        'Invalid or expired password reset code. Please request a new code.',
        'INVALID_RESET_TOKEN'
      );
    }

    if (
      !user.passwordResetToken ||
      user.passwordResetToken !== input.resetToken.trim() ||
      !user.passwordResetExpires ||
      user.passwordResetExpires < new Date()
    ) {
      throw AppError.badRequest(
        'Invalid or expired password reset code. Please request a new code.',
        'INVALID_RESET_TOKEN'
      );
    }

    // Hash new password
    const newPasswordHash = await hashPassword(input.newPassword);
    user.passwordHash = newPasswordHash;
    user.passwordResetToken = null;
    user.passwordResetExpires = null;
    await user.save();

    await auditService.logAction(
      user._id.toString(),
      'AUTH_PASSWORD_RESET_SUCCESS',
      meta?.requestId,
      { ip: meta?.ip, userAgent: meta?.userAgent }
    );

    return {
      message: 'Password has been reset successfully. You can now sign in with your new password.',
    };
  }

  async logout(
    userId: string,
    meta?: { ip?: string; userAgent?: string; requestId?: string }
  ) {
    await auditService.logAction(
      userId,
      'AUTH_LOGOUT',
      meta?.requestId,
      { ip: meta?.ip, userAgent: meta?.userAgent }
    );

    return { message: 'Successfully logged out.' };
  }

  async getMe(userId: string) {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw AppError.notFound('User account could not be found.', 'USER_NOT_FOUND');
    }
    if (!user.isActive) {
      throw AppError.unauthorized('User account is inactive.', 'ACCOUNT_INACTIVE');
    }
    return user.toJSON();
  }
}

export const authService = new AuthService();
