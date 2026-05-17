"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.attendanceController = void 0;
const prisma_js_1 = __importDefault(require("../db/prisma.js"));
exports.attendanceController = {
    async recordAttendance(req, res) {
        try {
            const authReq = req;
            const { sessionId, deviceId } = req.body;
            const attendance = await prisma_js_1.default.attendance.create({
                data: {
                    userId: authReq.user.id,
                    sessionId,
                    deviceId,
                    status: 'PRESENT',
                },
                include: { user: { select: { id: true, name: true, email: true } } },
            });
            res.status(201).json(attendance);
        }
        catch (error) {
            console.error('Record attendance error:', error);
            res.status(500).json({ message: 'Server error' });
        }
    },
    async getAttendanceByCourse(req, res) {
        try {
            const { courseId } = req.params;
            const session = await prisma_js_1.default.session.findFirst({
                where: { courseId, isActive: true },
                include: {
                    attendance: { include: { user: { select: { id: true, name: true, email: true } } } },
                },
            });
            res.json(session?.attendance || []);
        }
        catch (error) {
            console.error('Get attendance error:', error);
            res.status(500).json({ message: 'Server error' });
        }
    },
    async getStudentAttendance(req, res) {
        try {
            const authReq = req;
            const attendance = await prisma_js_1.default.attendance.findMany({
                where: { userId: authReq.user.id },
                include: { session: { include: { course: true } } },
            });
            res.json(attendance);
        }
        catch (error) {
            console.error('Get student attendance error:', error);
            res.status(500).json({ message: 'Server error' });
        }
    },
};
//# sourceMappingURL=attendanceController.js.map