import { describe, it, expect } from '@jest/globals';
import {
  normalizeIp,
  isIpv4,
  isIpv4InCidr,
  isTrustedCampusIp,
} from '../../src/utils/networkTrust';

describe('Network Trust Utility Unit Tests', () => {
  describe('normalizeIp', () => {
    it('should strip IPv4-mapped IPv6 prefix ::ffff:', () => {
      expect(normalizeIp('::ffff:192.168.1.50')).toBe('192.168.1.50');
      expect(normalizeIp('::ffff:127.0.0.1')).toBe('127.0.0.1');
    });

    it('should trim surrounding whitespace', () => {
      expect(normalizeIp('  10.0.0.1  ')).toBe('10.0.0.1');
    });

    it('should leave pure IPv4 and IPv6 untouched', () => {
      expect(normalizeIp('192.168.1.1')).toBe('192.168.1.1');
      expect(normalizeIp('::1')).toBe('::1');
    });
  });

  describe('isIpv4', () => {
    it('should accurately detect valid and invalid IPv4 formats', () => {
      expect(isIpv4('192.168.1.1')).toBe(true);
      expect(isIpv4('10.0.0.1')).toBe(true);
      expect(isIpv4('256.0.0.1')).toBe(false);
      expect(isIpv4('192.168.1')).toBe(false);
      expect(isIpv4('::1')).toBe(false);
    });
  });

  describe('isIpv4InCidr', () => {
    it('should correctly match IPs within /8, /16, /24 ranges', () => {
      // 10.0.0.0/8
      expect(isIpv4InCidr('10.15.2.3', '10.0.0.0/8')).toBe(true);
      expect(isIpv4InCidr('11.0.0.1', '10.0.0.0/8')).toBe(false);

      // 192.168.1.0/24
      expect(isIpv4InCidr('192.168.1.45', '192.168.1.0/24')).toBe(true);
      expect(isIpv4InCidr('192.168.2.1', '192.168.1.0/24')).toBe(false);

      // 172.16.0.0/12
      expect(isIpv4InCidr('172.20.10.5', '172.16.0.0/12')).toBe(true);
      expect(isIpv4InCidr('172.32.0.1', '172.16.0.0/12')).toBe(false);

      // Loopback /32 and /8
      expect(isIpv4InCidr('127.0.0.1', '127.0.0.1/32')).toBe(true);
      expect(isIpv4InCidr('127.0.0.2', '127.0.0.1/32')).toBe(false);
      expect(isIpv4InCidr('127.0.0.2', '127.0.0.0/8')).toBe(true);
    });
  });

  describe('isTrustedCampusIp', () => {
    const allowedIps = ['127.0.0.1', '::1', '203.0.113.10'];
    const allowedCidrs = ['10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16'];

    it('should allow loopback IP addresses', () => {
      expect(isTrustedCampusIp('127.0.0.1', allowedIps, allowedCidrs, true)).toBe(true);
      expect(isTrustedCampusIp('::1', allowedIps, allowedCidrs, true)).toBe(true);
      expect(isTrustedCampusIp('::ffff:127.0.0.1', allowedIps, allowedCidrs, true)).toBe(true);
    });

    it('should allow private campus subnets via CIDR', () => {
      expect(isTrustedCampusIp('10.200.5.12', allowedIps, allowedCidrs, true)).toBe(true);
      expect(isTrustedCampusIp('192.168.1.100', allowedIps, allowedCidrs, true)).toBe(true);
      expect(isTrustedCampusIp('172.18.0.50', allowedIps, allowedCidrs, true)).toBe(true);
    });

    it('should allow exact public campus IP', () => {
      expect(isTrustedCampusIp('203.0.113.10', allowedIps, allowedCidrs, true)).toBe(true);
    });

    it('should reject external untrusted public IP addresses', () => {
      expect(isTrustedCampusIp('203.0.113.11', allowedIps, allowedCidrs, true)).toBe(false);
      expect(isTrustedCampusIp('8.8.8.8', allowedIps, allowedCidrs, true)).toBe(false);
      expect(isTrustedCampusIp('198.51.100.25', allowedIps, allowedCidrs, true)).toBe(false);
    });

    it('should bypass check when disabled', () => {
      expect(isTrustedCampusIp('8.8.8.8', allowedIps, allowedCidrs, false)).toBe(true);
    });
  });
});
