import { auditLogRepository } from '../repositories/auditLog.repository';
import { logger } from '../utils/logger';

export class AuditService {
  async logAction(
    userId: string,
    action: string,
    requestId?: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    try {
      await auditLogRepository.create({
        userId,
        action,
        timestamp: new Date(),
        requestId,
        metadata,
      });
      logger.info({ userId, action, requestId }, `Audit logged: ${action}`);
    } catch (error) {
      // Non-blocking: audit failure should not break user operations, but should be logged
      logger.error({ error, action, userId }, 'Failed to write audit log');
    }
  }

  async getRecentLogs(limit = 100) {
    return auditLogRepository.findAll(limit);
  }
}

export const auditService = new AuditService();
