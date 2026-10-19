import { describe, it, expect } from '@jest/globals';
import { hashPassword, comparePassword, generateAccessToken, verifyAccessToken } from '../../src/utils/crypto';
import { JwtPayload } from '../../src/types';

describe('Crypto & Auth Utility', () => {
  it('should hash password and verify comparison correctly', async () => {
    const rawPassword = 'SecurePassword@2025';
    const hash = await hashPassword(rawPassword);

    expect(hash).toBeDefined();
    expect(hash).not.toEqual(rawPassword);

    const isMatch = await comparePassword(rawPassword, hash);
    expect(isMatch).toBe(true);

    const isWrongMatch = await comparePassword('WrongPassword', hash);
    expect(isWrongMatch).toBe(false);
  });

  it('should sign and verify JWT tokens correctly', () => {
    const samplePayload: JwtPayload = {
      userId: '60d0fe4f5311236168a109ca',
      email: 'test@college.edu',
      role: 'FACULTY',
      employeeId: 'EMP-001',
      name: 'Dr. Test Professor',
    };

    const token = generateAccessToken(samplePayload);
    expect(typeof token).toBe('string');
    expect(token.split('.').length).toBe(3);

    const decoded = verifyAccessToken(token);
    expect(decoded.userId).toBe(samplePayload.userId);
    expect(decoded.email).toBe(samplePayload.email);
    expect(decoded.role).toBe('FACULTY');
    expect(decoded.employeeId).toBe('EMP-001');
  });

  it('should throw error when verifying invalid token', () => {
    expect(() => verifyAccessToken('invalid.token.signature')).toThrow();
  });
});
