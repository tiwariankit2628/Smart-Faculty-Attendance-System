import { Router } from 'express';
import { adminController } from '../controllers/admin.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/role.middleware';
import { validateBody } from '../middleware/validate.middleware';
import {
  createFacultySchema,
  updateFacultySchema,
  updateZoneSchema,
  overrideAttendanceSchema,
  approveBiometricUpdateRequestSchema,
  rejectBiometricUpdateRequestSchema,
} from '../validators/admin.validator';

const router = Router();

// All admin routes require authenticated ADMIN role
router.use(authenticate);
router.use(authorize('ADMIN'));

// Dashboard statistics & analytics
router.get(
  '/dashboard/stats',
  adminController.getDashboardStats.bind(adminController)
);

router.post(
  '/faculty',
  validateBody(createFacultySchema),
  adminController.createFaculty.bind(adminController)
);

router.get(
  '/faculty',
  adminController.getAllFaculty.bind(adminController)
);

router.get(
  '/faculty/:id/detail',
  adminController.getFacultyDetail.bind(adminController)
);

router.patch(
  '/faculty/:id',
  validateBody(updateFacultySchema),
  adminController.updateFaculty.bind(adminController)
);

router.delete(
  '/faculty/:id',
  adminController.deleteFaculty.bind(adminController)
);

router.post(
  '/faculty/:id/reset-face',
  adminController.resetFacultyFace.bind(adminController)
);

router.get(
  '/attendance',
  adminController.getAttendance.bind(adminController)
);

router.get(
  '/attendance/review-queue',
  adminController.getReviewQueue.bind(adminController)
);

router.get(
  '/attendance/:id/detail',
  adminController.getAttendanceDetail.bind(adminController)
);

router.post(
  '/attendance/:id/override',
  validateBody(overrideAttendanceSchema),
  adminController.overrideAttendance.bind(adminController)
);

router.get(
  '/attendance/:id/evidence',
  adminController.getAttendanceEvidence.bind(adminController)
);

router.post(
  '/evidence/cleanup',
  adminController.cleanupExpiredEvidence.bind(adminController)
);

router.get(
  '/audit-logs',
  adminController.getAuditLogs.bind(adminController)
);

router.get(
  '/attendance-zone',
  adminController.getAttendanceZone.bind(adminController)
);

router.put(
  '/attendance-zone',
  validateBody(updateZoneSchema),
  adminController.updateAttendanceZone.bind(adminController)
);

// Biometric Photo Update Requests Review & Approval (Phase 10.5)
router.get(
  '/biometric-update-requests',
  adminController.getBiometricUpdateRequests.bind(adminController)
);

router.get(
  '/biometric-update-requests/:id',
  adminController.getBiometricUpdateRequestDetail.bind(adminController)
);

router.get(
  '/biometric-update-requests/:id/photo',
  adminController.getBiometricUpdateRequestCandidatePhoto.bind(adminController)
);

router.post(
  '/biometric-update-requests/:id/approve',
  validateBody(approveBiometricUpdateRequestSchema),
  adminController.approveBiometricUpdateRequest.bind(adminController)
);

router.post(
  '/biometric-update-requests/:id/reject',
  validateBody(rejectBiometricUpdateRequestSchema),
  adminController.rejectBiometricUpdateRequest.bind(adminController)
);

export const adminRoutes = router;
