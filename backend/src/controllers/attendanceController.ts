import { Request, Response } from 'express';
import prisma from '../db/prisma.js';

export const attendanceController = {
  async recordAttendance(req: Request, res: Response) {
    try {
      const authReq = req as any;
      const { sessionId, deviceId } = req.body;

      if (!sessionId) {
        return res.status(400).json({ message: 'sessionId is required' });
      }

      // 1. Verify session exists and is active
      const session = await prisma.session.findUnique({
        where: { id: sessionId },
        include: { course: true },
      });

      if (!session) {
        return res.status(404).json({ message: 'Session not found' });
      }

      if (!session.isActive) {
        return res.status(400).json({ message: 'Attendance session has ended or is inactive' });
      }

      // 2. Check if already marked
      const existing = await prisma.attendance.findUnique({
        where: {
          userId_sessionId: {
            userId: authReq.user.id,
            sessionId,
          },
        },
      });

      if (existing) {
        return res.status(400).json({
          message: 'Attendance already recorded for this session',
          attendance: existing,
        });
      }

      // 3. Ensure student is enrolled in the course
      await prisma.courseStudent.upsert({
        where: {
          courseId_studentId: {
            courseId: session.courseId,
            studentId: authReq.user.id,
          },
        },
        create: {
          courseId: session.courseId,
          studentId: authReq.user.id,
        },
        update: {},
      });

      // 4. Record attendance
      const attendance = await prisma.attendance.create({
        data: {
          userId: authReq.user.id,
          sessionId,
          deviceId: deviceId || 'BLE_DEFAULT',
          status: 'PRESENT',
        },
        include: {
          user: { select: { id: true, name: true, email: true } },
          session: {
            include: { course: true },
          },
        },
      });

      res.status(201).json({
        message: 'Attendance recorded successfully',
        attendance,
      });
    } catch (error) {
      console.error('Record attendance error:', error);
      res.status(500).json({ message: 'Server error while recording attendance' });
    }
  },

  async getAttendanceByCourse(req: Request, res: Response) {
    try {
      const courseId = req.params.courseId as string;

      const sessions = await prisma.session.findMany({
        where: { courseId },
        include: {
          attendance: {
            include: {
              user: { select: { id: true, name: true, email: true } },
            },
            orderBy: { timestamp: 'desc' },
          },
        },
        orderBy: { startTime: 'desc' },
      });

      res.json(sessions);
    } catch (error) {
      console.error('Get attendance error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  },

  async getStudentAttendance(req: Request, res: Response) {
    try {
      const authReq = req as any;

      const attendanceList = await prisma.attendance.findMany({
        where: { userId: authReq.user.id },
        include: {
          session: {
            include: {
              course: true,
              teacher: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { timestamp: 'desc' },
      });

      // Compute statistics
      const totalAttended = attendanceList.length;

      res.json({
        totalAttended,
        records: attendanceList,
      });
    } catch (error) {
      console.error('Get student attendance error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  },
};
