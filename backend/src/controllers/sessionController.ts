import { Request, Response } from 'express';
import prisma from '../db/prisma.js';

export const sessionController = {
  // Start a new attendance session for a course
  async startSession(req: Request, res: Response) {
    try {
      const authReq = req as any;
      const { courseId, beaconId } = req.body;

      if (!courseId) {
        return res.status(400).json({ message: 'courseId is required' });
      }

      // Verify the course belongs to the teacher
      const course = await prisma.course.findUnique({
        where: { id: courseId },
      });

      if (!course) {
        return res.status(404).json({ message: 'Course not found' });
      }

      if (course.teacherId !== authReq.user.id) {
        return res.status(403).json({ message: 'You are not authorized to start a session for this course' });
      }

      // Deactivate any currently active sessions for this course
      await prisma.session.updateMany({
        where: { courseId, isActive: true },
        data: { isActive: false, endTime: new Date() },
      });

      // Create new active session
      const session = await prisma.session.create({
        data: {
          courseId,
          teacherId: authReq.user.id,
          beaconId: beaconId || `BEACON-${course.code}`,
          isActive: true,
          startTime: new Date(),
        },
        include: {
          course: true,
          teacher: { select: { id: true, name: true, email: true } },
        },
      });

      res.status(201).json(session);
    } catch (error) {
      console.error('Start session error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  },

  // Stop an active session
  async stopSession(req: Request, res: Response) {
    try {
      const authReq = req as any;
      const sessionId = req.params.sessionId as string;

      const session = await prisma.session.findUnique({
        where: { id: sessionId },
      });

      if (!session) {
        return res.status(404).json({ message: 'Session not found' });
      }

      if (session.teacherId !== authReq.user.id) {
        return res.status(403).json({ message: 'Not authorized to stop this session' });
      }

      const updated = await prisma.session.update({
        where: { id: sessionId },
        data: {
          isActive: false,
          endTime: new Date(),
        },
        include: {
          course: true,
          _count: { select: { attendance: true } },
        },
      });

      res.json(updated);
    } catch (error) {
      console.error('Stop session error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  },

  // Get currently active sessions (for students to discover)
  async getActiveSessions(req: Request, res: Response) {
    try {
      const sessions = await prisma.session.findMany({
        where: { isActive: true },
        include: {
          course: true,
          teacher: { select: { id: true, name: true, email: true } },
          _count: { select: { attendance: true } },
        },
        orderBy: { startTime: 'desc' },
      });

      res.json(sessions);
    } catch (error) {
      console.error('Get active sessions error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  },

  // Get attendees for a specific session
  async getSessionAttendance(req: Request, res: Response) {
    try {
      const sessionId = req.params.sessionId as string;

      const session = await prisma.session.findUnique({
        where: { id: sessionId },
        include: {
          course: true,
          attendance: {
            include: {
              user: { select: { id: true, name: true, email: true } },
            },
            orderBy: { timestamp: 'desc' },
          },
        },
      });

      if (!session) {
        return res.status(404).json({ message: 'Session not found' });
      }

      res.json(session);
    } catch (error) {
      console.error('Get session attendance error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  },
};
