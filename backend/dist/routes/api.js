import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import { authController } from '../controllers/authController.js';
import { attendanceController } from '../controllers/attendanceController.js';
import { courseController } from '../controllers/courseController.js';
import { sessionController } from '../controllers/sessionController.js';
const router = Router();
// Public health check
router.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
// Auth routes
router.post('/auth/register', authController.register);
router.post('/auth/login', authController.login);
// Protected routes (require JWT)
router.use(authenticate);
router.get('/auth/me', authController.getMe);
router.post('/auth/logout', authController.logout);
// Session routes
router.get('/sessions/active', sessionController.getActiveSessions);
router.get('/sessions/:sessionId/attendance', sessionController.getSessionAttendance);
router.post('/sessions/start', requireRole('TEACHER'), sessionController.startSession);
router.post('/sessions/:sessionId/stop', requireRole('TEACHER'), sessionController.stopSession);
// Attendance routes
router.post('/attendance', attendanceController.recordAttendance);
router.get('/attendance/course/:courseId', attendanceController.getAttendanceByCourse);
router.get('/attendance/my', attendanceController.getStudentAttendance);
// Course routes
router.get('/courses', courseController.getAllCourses);
router.post('/courses', requireRole('TEACHER'), courseController.createCourse);
router.post('/courses/enroll', courseController.enrollCourse);
router.get('/teachers/:teacherId/courses', requireRole('TEACHER'), courseController.getTeacherCourses);
router.get('/students/:studentId/courses', courseController.getStudentCourses);
export default router;
//# sourceMappingURL=api.js.map