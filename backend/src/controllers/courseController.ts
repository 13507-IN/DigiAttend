import { Request, Response } from 'express';
import prisma from '../db/prisma.js';

export const courseController = {
  async getTeacherCourses(req: Request, res: Response) {
    try {
      const authReq = req as any;
      const courses = await prisma.course.findMany({
        where: { teacherId: authReq.user.id },
        include: { _count: { select: { students: true } } },
      });
      res.json(courses);
    } catch (error) {
      console.error('Get teacher courses error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  },

  async getStudentCourses(req: Request, res: Response) {
    try {
      const authReq = req as any;
      const courses = await prisma.courseStudent.findMany({
        where: { studentId: authReq.user.id },
        include: { course: true },
      });
      res.json(courses.map((cs) => cs.course));
    } catch (error) {
      console.error('Get student courses error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  },

  async createCourse(req: Request, res: Response) {
    try {
      const authReq = req as any;
      const { name, code, schedule, location } = req.body;

      const course = await prisma.course.create({
        data: { name, code, schedule, location, teacherId: authReq.user.id },
      });

      res.status(201).json(course);
    } catch (error) {
      console.error('Create course error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  },
};