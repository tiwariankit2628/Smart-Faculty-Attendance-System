import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { app } from '../../src/app';
import { connectDB, disconnectDB } from '../../src/config/db';

describe('Auth & Multi-Faculty Integration Tests', () => {
  beforeAll(async () => {
    await connectDB();
  });

  afterAll(async () => {
    await disconnectDB();
  });

  const testEmpId = `TEST-FAC-${Date.now().toString().slice(-4)}`;
  const testEmail = `faculty.${Date.now()}@lpu.in`;
  const initialPassword = 'Password@123';
  const newPassword = 'NewPassword@456';
  let resetCode: string;

  describe('POST /api/v1/auth/register', () => {
    it('should successfully register a new faculty member with unique ID and email', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Prof. Ananya Singh',
          email: testEmail,
          employeeId: testEmpId,
          password: initialPassword,
          department: 'Department of Biotechnology',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toBeDefined();
      expect(response.body.data.user.email).toBe(testEmail.toLowerCase());
      expect(response.body.data.user.employeeId).toBe(testEmpId);
      expect(response.body.data.user.role).toBe('FACULTY');
      expect(response.body.data.token).toBeDefined();
      expect(response.headers['set-cookie']).toBeDefined();
    });

    it('should reject registration with duplicate email', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Another Faculty',
          email: testEmail, // duplicate
          employeeId: `DIFF-${Date.now().toString().slice(-4)}`,
          password: initialPassword,
          department: 'Civil Engineering',
        });

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('EMAIL_ALREADY_EXISTS');
    });

    it('should reject registration with duplicate employee/faculty ID', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Another Faculty',
          email: `different.${Date.now()}@lpu.in`,
          employeeId: testEmpId, // duplicate
          password: initialPassword,
          department: 'Civil Engineering',
        });

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('FACULTY_ID_ALREADY_EXISTS');
    });
  });

  describe('POST /api/v1/auth/forgot-password & reset-password', () => {
    it('should generate password reset verification code for registered email', async () => {
      const response = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ email: testEmail });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.resetToken).toBeDefined();
      resetCode = response.body.data.resetToken;
    });

    it('should reset password with valid code', async () => {
      const response = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({
          email: testEmail,
          resetToken: resetCode,
          newPassword: newPassword,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toContain('reset successfully');
    });

    it('should login successfully with the new password', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testEmail,
          password: newPassword,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.employeeId).toBe(testEmpId);
    });
  });
});
