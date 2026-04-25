import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { attendanceController } from '../controllers/attendanceController';
import { courseController } from '../controllers/courseController';

const router = Router();

router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

router.use(authenticate);

router.post('/attendance', attendanceController.recordAttendance);
router.get('/attendance/course/:courseId', attendanceController.getAttendanceByCourse);
router.get('/attendance/my', attendanceController.getStudentAttendance);

router.get('/teachers/:teacherId/courses', courseController.getTeacherCourses);
router.get('/students/:studentId/courses', courseController.getStudentCourses);
router.post('/courses', courseController.createCourse);

export default router;