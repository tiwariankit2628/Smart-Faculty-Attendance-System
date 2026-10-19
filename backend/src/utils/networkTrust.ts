import { env } from '../config/env';
import { logger } from './logger';

/**
 * Normalizes an IP address:
 * - Trims whitespace
 * - Strips IPv4-mapped IPv6 prefix '::ffff:' (e.g., '::ffff:127.0.0.1' -> '127.0.0.1')
 */
export function normalizeIp(ip: string): string {
  if (!ip) return '';
  let cleaned = ip.trim();
  if (cleaned.startsWith('::ffff:')) {
    cleaned = cleaned.substring(7);
  }
  return cleaned;
}

/**
 * Checks if a string is a valid IPv4 address (e.g. '192.168.1.1')
 */
export function isIpv4(ip: string): boolean {
  const parts = ip.split('.');
  if (parts.length !== 4) return false;
  return parts.every((p) => {
    const num = Number(p);
    return !isNaN(num) && num >= 0 && num <= 255 && String(num) === p;
  });
}

/**
 * Converts an IPv4 string into an unsigned 32-bit integer
 */
export function ipv4ToInt(ip: string): number {
  const parts = ip.split('.').map(Number);
  return (((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0);
}

/**
 * Checks if an IPv4 address belongs to an IPv4 CIDR range (e.g., '192.168.0.0/16')
 */
export function isIpv4InCidr(ip: string, cidr: string): boolean {
  const [network, prefixStr] = cidr.trim().split('/');
  if (!network || !prefixStr) return false;
  if (!isIpv4(ip) || !isIpv4(network)) return false;

  const prefix = Number(prefixStr);
  if (isNaN(prefix) || prefix < 0 || prefix > 32) return false;

  const ipInt = ipv4ToInt(ip);
  const networkInt = ipv4ToInt(network);
  const mask = prefix === 0 ? 0 : ((0xffffffff << (32 - prefix)) >>> 0);

  return (ipInt & mask) === (networkInt & mask);
}

/**
 * Parses comma-separated IP / CIDR environment variables
 */
export function parseList(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Validates whether the incoming client IP address originates from
 * an authorized campus network or allowlisted IP / CIDR range.
 */
export function isTrustedCampusIp(
  clientIp: string,
  customAllowedIps?: string[],
  customAllowedCidrs?: string[],
  enabled?: boolean
): boolean {
  const isEnabled = enabled !== undefined ? enabled : env.ENABLE_CAMPUS_NETWORK_CHECK;
  if (!isEnabled) {
    return true;
  }

  const normalized = normalizeIp(clientIp);
  if (!normalized) {
    logger.warn({ rawIp: clientIp }, 'Empty or invalid client IP provided for campus network check');
    return false;
  }

  const allowedIps = customAllowedIps || parseList(env.CAMPUS_ALLOWED_IPS);
  const allowedCidrs = customAllowedCidrs || parseList(env.CAMPUS_ALLOWED_CIDRS);

  // 1. Direct exact match check (case-insensitive for IPv6)
  for (const allowed of allowedIps) {
    const normalizedAllowed = normalizeIp(allowed);
    if (normalized.toLowerCase() === normalizedAllowed.toLowerCase()) {
      return true;
    }
  }

  // 2. CIDR range check (for IPv4 clients)
  if (isIpv4(normalized)) {
    for (const cidr of allowedCidrs) {
      if (isIpv4InCidr(normalized, cidr)) {
        return true;
      }
    }
  }

  logger.warn(
    { clientIp, normalized, allowedIpsCount: allowedIps.length, allowedCidrsCount: allowedCidrs.length },
    'Client IP rejected: does not match authorized campus network'
  );

  return false;
}
