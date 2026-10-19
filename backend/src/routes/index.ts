import { Router } from 'express';
import { authRoutes } from './auth.routes';
import { facultyRoutes } from './faculty.routes';
import { attendanceRoutes } from './attendance.routes';
import { adminRoutes } from './admin.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/faculty', facultyRoutes);
router.use('/attendance', attendanceRoutes);
router.use('/admin', adminRoutes);

export const apiV1Routes = router;
