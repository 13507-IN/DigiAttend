"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.courseController = void 0;
const prisma_js_1 = __importDefault(require("../db/prisma.js"));
exports.courseController = {
    async getTeacherCourses(req, res) {
        try {
            const authReq = req;
            const courses = await prisma_js_1.default.course.findMany({
                where: { teacherId: authReq.user.id },
                include: { _count: { select: { students: true } } },
            });
            res.json(courses);
        }
        catch (error) {
            console.error('Get teacher courses error:', error);
            res.status(500).json({ message: 'Server error' });
        }
    },
    async getStudentCourses(req, res) {
        try {
            const authReq = req;
            const courses = await prisma_js_1.default.courseStudent.findMany({
                where: { studentId: authReq.user.id },
                include: { course: true },
            });
            res.json(courses.map((cs) => cs.course));
        }
        catch (error) {
            console.error('Get student courses error:', error);
            res.status(500).json({ message: 'Server error' });
        }
    },
    async createCourse(req, res) {
        try {
            const authReq = req;
            const { name, code, schedule, location } = req.body;
            const course = await prisma_js_1.default.course.create({
                data: { name, code, schedule, location, teacherId: authReq.user.id },
            });
            res.status(201).json(course);
        }
        catch (error) {
            console.error('Create course error:', error);
            res.status(500).json({ message: 'Server error' });
        }
    },
};
//# sourceMappingURL=courseController.js.map