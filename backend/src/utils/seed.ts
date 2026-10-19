import { UserModel } from '../models/User';
import { AttendanceZoneModel } from '../models/AttendanceZone';
import { hashPassword } from './crypto';
import { env } from '../config/env';
import { logger } from './logger';

export async function seedInitialData(): Promise<void> {
  try {
    // 1. Seed Default Geofence Zone if none exists
    const zoneCount = await AttendanceZoneModel.countDocuments();
    if (zoneCount === 0) {
      await AttendanceZoneModel.create({
        name: 'Lovely Professional University (LPU) - Main Campus',
        latitude: env.DEFAULT_GEOFENCE_LAT,
        longitude: env.DEFAULT_GEOFENCE_LNG,
        radiusMeters: env.DEFAULT_GEOFENCE_RADIUS_METERS,
        maxAllowedAccuracyMeters: env.MAX_ALLOWED_ACCURACY_METERS,
        isActive: true,
      });
      logger.info(' Default Attendance Geofence Zone for LPU seeded successfully.');
    }

    // 2. Seed Default Administrator if none exists
    const adminExists = await UserModel.findOne({ role: 'ADMIN' });
    if (!adminExists) {
      const adminPasswordHash = await hashPassword('AdminPassword@123');
      await UserModel.create({
        name: 'LPU System Administrator',
        email: 'admin@lpu.in',
        employeeId: 'LPU-ADM-001',
        passwordHash: adminPasswordHash,
        role: 'ADMIN',
        department: 'Division of Academic Affairs, LPU',
        isActive: true,
      });
      logger.info(' Default LPU Admin user created: admin@lpu.in / AdminPassword@123');
    }

    // 3. Seed Multiple Sample Faculty accounts independently
    const sampleFacultyMembers = [
      {
        name: 'Dr. Amit Sharma',
        email: 'faculty@lpu.in',
        employeeId: 'LPU-FAC-101',
        password: 'FacultyPassword@123',
        department: 'School of Computer Science & Engineering (SCSE)',
        faceEmbeddingReference: 'face_emb_faculty_lpu_101',
      },
      {
        name: 'Dr. Priya Patel',
        email: 'priya.patel@lpu.in',
        employeeId: 'LPU-FAC-102',
        password: 'FacultyPassword@123',
        department: 'Department of Electronics & Communication',
        faceEmbeddingReference: null,
      },
      {
        name: 'Prof. Rajesh Verma',
        email: 'rajesh.verma@lpu.in',
        employeeId: 'LPU-FAC-103',
        password: 'FacultyPassword@123',
        department: 'Department of Mechanical Engineering',
        faceEmbeddingReference: null,
      },
    ];

    for (const faculty of sampleFacultyMembers) {
      const exists = await UserModel.findOne({
        $or: [{ email: faculty.email }, { employeeId: faculty.employeeId }],
      });

      if (!exists) {
        const passwordHash = await hashPassword(faculty.password);
        await UserModel.create({
          name: faculty.name,
          email: faculty.email,
          employeeId: faculty.employeeId,
          passwordHash,
          role: 'FACULTY',
          department: faculty.department,
          faceEmbeddingReference: faculty.faceEmbeddingReference,
          isActive: true,
        });
        logger.info(` Faculty user created: ${faculty.email} (${faculty.employeeId}) / ${faculty.name}`);
      }
    }
  } catch (error) {
    logger.warn({ error }, '⚠️ Auto-seeding skipped or failed (safe to ignore if offline/testing).');
  }
}
