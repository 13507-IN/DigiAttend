"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_js_1 = require("../middleware/auth.js");
const authController_js_1 = require("../controllers/authController.js");
const attendanceController_js_1 = require("../controllers/attendanceController.js");
const courseController_js_1 = require("../controllers/courseController.js");
const router = (0, express_1.Router)();
router.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
router.post('/auth/register', authController_js_1.authController.register);
router.post('/auth/login', authController_js_1.authController.login);
router.use(auth_js_1.authenticate);
router.post('/attendance', attendanceController_js_1.attendanceController.recordAttendance);
router.get('/attendance/course/:courseId', attendanceController_js_1.attendanceController.getAttendanceByCourse);
router.get('/attendance/my', attendanceController_js_1.attendanceController.getStudentAttendance);
router.get('/teachers/:teacherId/courses', (0, auth_js_1.requireRole)('TEACHER'), courseController_js_1.courseController.getTeacherCourses);
router.get('/students/:studentId/courses', courseController_js_1.courseController.getStudentCourses);
router.post('/courses', (0, auth_js_1.requireRole)('TEACHER'), courseController_js_1.courseController.createCourse);
exports.default = router;
//# sourceMappingURL=api.js.map