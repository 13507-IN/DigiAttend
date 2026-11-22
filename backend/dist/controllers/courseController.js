import prisma from '../db/prisma.js';
export const courseController = {
    // Get all courses in the system
    async getAllCourses(req, res) {
        try {
            const courses = await prisma.course.findMany({
                include: {
                    teacher: { select: { id: true, name: true, email: true } },
                    _count: { select: { students: true, sessions: true } },
                },
                orderBy: { createdAt: 'desc' },
            });
            res.json(courses);
        }
        catch (error) {
            console.error('Get all courses error:', error);
            res.status(500).json({ message: 'Server error' });
        }
    },
    // Get courses taught by teacher
    async getTeacherCourses(req, res) {
        try {
            const authReq = req;
            const courses = await prisma.course.findMany({
                where: { teacherId: authReq.user.id },
                include: {
                    _count: { select: { students: true, sessions: true } },
                    sessions: {
                        where: { isActive: true },
                        take: 1,
                        include: {
                            _count: { select: { attendance: true } },
                        },
                    },
                },
                orderBy: { createdAt: 'desc' },
            });
            res.json(courses);
        }
        catch (error) {
            console.error('Get teacher courses error:', error);
            res.status(500).json({ message: 'Server error' });
        }
    },
    // Get courses enrolled by student
    async getStudentCourses(req, res) {
        try {
            const authReq = req;
            const enrollments = await prisma.courseStudent.findMany({
                where: { studentId: authReq.user.id },
                include: {
                    course: {
                        include: {
                            teacher: { select: { id: true, name: true } },
                            sessions: {
                                where: { isActive: true },
                                take: 1,
                            },
                        },
                    },
                },
            });
            res.json(enrollments.map((e) => e.course));
        }
        catch (error) {
            console.error('Get student courses error:', error);
            res.status(500).json({ message: 'Server error' });
        }
    },
    // Create course (teacher only)
    async createCourse(req, res) {
        try {
            const authReq = req;
            const { name, code, schedule, location } = req.body;
            if (!name || !code || !schedule) {
                return res.status(400).json({ message: 'Name, code, and schedule are required' });
            }
            const existing = await prisma.course.findUnique({
                where: { code: code.trim().toUpperCase() },
            });
            if (existing) {
                return res.status(400).json({ message: `Course with code ${code} already exists` });
            }
            const course = await prisma.course.create({
                data: {
                    name: name.trim(),
                    code: code.trim().toUpperCase(),
                    schedule: schedule.trim(),
                    location: location ? location.trim() : null,
                    teacherId: authReq.user.id,
                },
                include: {
                    teacher: { select: { id: true, name: true } },
                    _count: { select: { students: true } },
                },
            });
            res.status(201).json(course);
        }
        catch (error) {
            console.error('Create course error:', error);
            res.status(500).json({ message: 'Server error' });
        }
    },
    // Student enroll in course
    async enrollCourse(req, res) {
        try {
            const authReq = req;
            const { courseId } = req.body;
            if (!courseId) {
                return res.status(400).json({ message: 'courseId is required' });
            }
            const course = await prisma.course.findUnique({
                where: { id: courseId },
            });
            if (!course) {
                return res.status(404).json({ message: 'Course not found' });
            }
            const enrollment = await prisma.courseStudent.upsert({
                where: {
                    courseId_studentId: {
                        courseId,
                        studentId: authReq.user.id,
                    },
                },
                create: {
                    courseId,
                    studentId: authReq.user.id,
                },
                update: {},
            });
            res.status(200).json({ message: 'Enrolled successfully', enrollment });
        }
        catch (error) {
            console.error('Enroll course error:', error);
            res.status(500).json({ message: 'Server error' });
        }
    },
};
//# sourceMappingURL=courseController.js.map