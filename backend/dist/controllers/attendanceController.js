import prisma from '../db/prisma.js';
export const attendanceController = {
    async recordAttendance(req, res) {
        try {
            const authReq = req;
            const { sessionId, deviceId } = req.body;
            const attendance = await prisma.attendance.create({
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
            const courseId = req.params.courseId;
            const session = await prisma.session.findFirst({
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
            const attendance = await prisma.attendance.findMany({
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