import http from 'http';
import { app } from './app';
import { env } from './config/env';
import { connectDB, disconnectDB } from './config/db';
import { redis } from './config/redis';
import { seedInitialData } from './utils/seed';
import { adminService } from './services/admin.service';
import { logger } from './utils/logger';

async function bootstrap() {
  try {
    // 1. Establish Database Connection
    await connectDB();

    // 2. Initialize Default Geofence & Admin Data
    await seedInitialData();

    // 3. Crash Recovery Reconciliation: Reconcile any interrupted biometric approvals
    try {
      const reconResult = await adminService.reconcileStaleRequests();
      if (reconResult.reconciledCount > 0) {
        logger.info(
          { reconciledCount: reconResult.reconciledCount, details: reconResult.details },
          'Biometric crash recovery reconciliation completed during server boot'
        );
      }
    } catch (reconErr) {
      logger.error({ reconErr }, 'Non-fatal error during startup biometric reconciliation');
    }

    // 4. Start HTTP Server
    const server = http.createServer(app);

    server.listen(env.PORT, () => {
      logger.info(
        ` Geo-Verified Faculty Attendance Server running in ${env.NODE_ENV} mode on port ${env.PORT}`
      );
      logger.info(` Health check available at: http://localhost:${env.PORT}/health`);
      logger.info(` API base endpoint at: http://localhost:${env.PORT}/api/v1`);
    });

    // 4. Graceful Shutdown Handlers
    const handleShutdown = async (signal: string) => {
      logger.info(`Received ${signal}. Shutting down server gracefully...`);

      server.close(async () => {
        logger.info('HTTP server closed.');

        try {
          await disconnectDB();
          redis.disconnect();
          logger.info('Clean shutdown completed successfully.');
          process.exit(0);
        } catch (err) {
          logger.error({ err }, 'Error during shutdown');
          process.exit(1);
        }
      });

      // Force terminate if graceful shutdown hangs beyond 10 seconds
      setTimeout(() => {
        logger.error('Forced shutdown due to timeout.');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => handleShutdown('SIGTERM'));
    process.on('SIGINT', () => handleShutdown('SIGINT'));
  } catch (error) {
    logger.error({ error }, 'Fatal error during application startup');
    process.exit(1);
  }
}

bootstrap();
