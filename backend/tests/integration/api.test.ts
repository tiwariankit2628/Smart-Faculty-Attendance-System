import { describe, it, expect } from '@jest/globals';
import request from 'supertest';
import { app } from '../../src/app';
import { generateAccessToken } from '../../src/utils/crypto';
import { JwtPayload } from '../../src/types';

describe('API Integration Tests', () => {
  describe('GET /health', () => {
    it('should return healthy status with 200 OK', async () => {
      const response = await request(app).get('/health');
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('healthy');
      expect(response.body.service).toBe('geo-faculty-attendance-backend');
    });
  });

  describe('404 Route Not Found', () => {
    it('should return 404 in standard error format for undefined routes', async () => {
      const response = await request(app).get('/api/v1/non-existent-endpoint');
      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: expect.stringContaining('not found'),
        },
      });
    });
  });

  describe('Input Validation on /api/v1/auth/login', () => {
    it('should reject requests with invalid email and short password', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'not-an-email', password: '123' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details).toBeInstanceOf(Array);
    });
  });

  describe('Route Protection & Role Middleware', () => {
    it('should reject unauthenticated requests to protected endpoints with 401', async () => {
      const response = await request(app).get('/api/v1/auth/me');
      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should reject non-admin users attempting to access admin endpoints with 403', async () => {
      const facultyPayload: JwtPayload = {
        userId: '60d0fe4f5311236168a109ca',
        email: 'faculty@college.edu',
        role: 'FACULTY',
        employeeId: 'EMP-001',
        name: 'Dr. Faculty',
      };
      const facultyToken = generateAccessToken(facultyPayload);

      const response = await request(app)
        .get('/api/v1/admin/attendance-zone')
        .set('Cookie', [`access_token=${facultyToken}`]);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });

    it('should reject attendance submission lacking locationToken and faceToken with 400 validation error', async () => {
      const facultyPayload: JwtPayload = {
        userId: '60d0fe4f5311236168a109ca',
        email: 'faculty@college.edu',
        role: 'FACULTY',
        employeeId: 'EMP-001',
        name: 'Dr. Faculty',
      };
      const facultyToken = generateAccessToken(facultyPayload);

      const response = await request(app)
        .post('/api/v1/attendance/mark')
        .set('Cookie', [`access_token=${facultyToken}`])
        .send({
          latitude: 31.2536,
          longitude: 75.7037,
          accuracy: 10,
          // Missing locationToken and faceToken
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });
});
