import { Router } from 'express';
import { facultyController } from '../controllers/faculty.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/role.middleware';
import { validateBody } from '../middleware/validate.middleware';
import { faceRegistrationRateLimiter } from '../middleware/rateLimiter.middleware';
import {
  faceRegistrationSchema,
  createBiometricUpdateRequestSchema,
} from '../validators/faculty.validator';

const router = Router();

// Require authenticated faculty (or admin)
router.use(authenticate);

router.get(
  '/profile',
  authorize('FACULTY', 'ADMIN'),
  facultyController.getProfile.bind(facultyController)
);

router.get(
  '/attendance',
  authorize('FACULTY', 'ADMIN'),
  facultyController.getAttendance.bind(facultyController)
);

router.post(
  '/face-registration',
  authorize('FACULTY'),
  faceRegistrationRateLimiter,
  validateBody(faceRegistrationSchema),
  facultyController.registerFace.bind(facultyController)
);

// Phase 10.4: Biometric Photo Update Requests
router.post(
  '/biometric-update-requests',
  authorize('FACULTY'),
  faceRegistrationRateLimiter,
  validateBody(createBiometricUpdateRequestSchema),
  facultyController.createBiometricUpdateRequest.bind(facultyController)
);

router.get(
  '/biometric-update-requests',
  authorize('FACULTY'),
  facultyController.getBiometricUpdateRequests.bind(facultyController)
);

// Faculty Notifications Routes
router.get(
  '/notifications',
  authorize('FACULTY', 'ADMIN'),
  facultyController.getNotifications.bind(facultyController)
);

router.get(
  '/notifications/unread-count',
  authorize('FACULTY', 'ADMIN'),
  facultyController.getUnreadCount.bind(facultyController)
);

router.patch(
  '/notifications/read-all',
  authorize('FACULTY', 'ADMIN'),
  facultyController.markAllNotificationsAsRead.bind(facultyController)
);

router.patch(
  '/notifications/:id/read',
  authorize('FACULTY', 'ADMIN'),
  facultyController.markNotificationAsRead.bind(facultyController)
);

export const facultyRoutes = router;
