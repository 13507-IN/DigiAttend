import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../db/prisma.js';
import { config } from '../config/index.js';

interface RegisterBody {
  email: string;
  password: string;
  name: string;
  role?: 'TEACHER' | 'STUDENT';
}

interface LoginBody {
  email: string;
  password: string;
}

const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const validatePassword = (password: string): { valid: boolean; message?: string } => {
  if (password.length < 6) {
    return { valid: false, message: 'Password must be at least 6 characters' };
  }
  return { valid: true };
};

export const authController = {
  async login(req: Request, res: Response) {
    try {
      const { email, password }: LoginBody = req.body;

      if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
      }

      if (!validateEmail(email)) {
        return res.status(400).json({ message: 'Invalid email format' });
      }

      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        config.jwtSecret,
        { expiresIn: '7d' }
      );

      const userResponse = {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role.toLowerCase() as 'teacher' | 'student',
      };

      res.json({ user: userResponse, token });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  },

  async register(req: Request, res: Response) {
    try {
      const { email, password, name, role = 'STUDENT' }: RegisterBody = req.body;

      if (!email || !password || !name) {
        return res.status(400).json({ message: 'Email, password, and name are required' });
      }

      if (!validateEmail(email)) {
        return res.status(400).json({ message: 'Invalid email format' });
      }

      const passwordValidation = validatePassword(password);
      if (!passwordValidation.valid) {
        return res.status(400).json({ message: passwordValidation.message });
      }

      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        return res.status(400).json({ message: 'Email already exists' });
      }

      const hashedPassword = await bcrypt.hash(password, 12);
      const user = await prisma.user.create({
        data: { 
          email, 
          password: hashedPassword, 
          name, 
          role: (role === 'TEACHER' || role === 'teacher') ? 'TEACHER' : 'STUDENT' 
        },
      });

      const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        config.jwtSecret,
        { expiresIn: '7d' }
      );

      const userResponse = {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role.toLowerCase() as 'teacher' | 'student',
      };

      res.status(201).json({ user: userResponse, token });
    } catch (error) {
      console.error('Register error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  },

  async getMe(req: Request, res: Response) {
    try {
      const authReq = req as AuthRequest;
      const user = await prisma.user.findUnique({
        where: { id: authReq.user.id },
        select: { id: true, email: true, name: true, role: true, createdAt: true },
      });
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      res.json({
        ...user,
        role: user.role.toLowerCase(),
      });
    } catch (error) {
      console.error('Get me error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  },

  async logout(req: Request, res: Response) {
    try {
      res.json({ message: 'Logged out successfully' });
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  },
};

interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}