import { Router } from 'express';
import { attendanceController } from '../controllers/attendance.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/role.middleware';
import { validateBody } from '../middleware/validate.middleware';
import { attendanceRateLimiter, challengeRateLimiter } from '../middleware/rateLimiter.middleware';
import {
  verifyLocationSchema,
  verifyFaceSchema,
  markAttendanceSchema,
} from '../validators/attendance.validator';

const router = Router();

// Require authenticated faculty for attendance actions
router.use(authenticate);
router.use(authorize('FACULTY'));

router.post(
  '/challenge',
  challengeRateLimiter,
  attendanceController.createChallenge.bind(attendanceController)
);

router.post(
  '/verify-location',
  attendanceRateLimiter,
  validateBody(verifyLocationSchema),
  attendanceController.verifyLocation.bind(attendanceController)
);

router.post(
  '/verify-face',
  attendanceRateLimiter,
  validateBody(verifyFaceSchema),
  attendanceController.verifyFace.bind(attendanceController)
);

router.post(
  '/mark',
  attendanceRateLimiter,
  validateBody(markAttendanceSchema),
  attendanceController.markAttendance.bind(attendanceController)
);

router.get(
  '/today',
  attendanceController.getToday.bind(attendanceController)
);

router.get(
  '/history',
  attendanceController.getHistory.bind(attendanceController)
);

export const attendanceRoutes = router;
