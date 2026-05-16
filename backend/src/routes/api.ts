import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import { authController } from '../controllers/authController.js';
import { attendanceController } from '../controllers/attendanceController.js';
import { courseController } from '../controllers/courseController.js';

const router = Router();

router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

router.post('/auth/register', authController.register);
router.post('/auth/login', authController.login);

router.use(authenticate);

router.post('/attendance', attendanceController.recordAttendance);
router.get('/attendance/course/:courseId', attendanceController.getAttendanceByCourse);
router.get('/attendance/my', attendanceController.getStudentAttendance);

router.get('/teachers/:teacherId/courses', requireRole('TEACHER'), courseController.getTeacherCourses);
router.get('/students/:studentId/courses', courseController.getStudentCourses);
router.post('/courses', requireRole('TEACHER'), courseController.createCourse);

export default router;