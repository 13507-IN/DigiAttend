export interface User {
  id: string;
  email: string;
  name: string;
  role: 'teacher' | 'student';
  createdAt?: string;
  updatedAt?: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials extends LoginCredentials {
  name: string;
  role?: 'teacher' | 'student';
}

export interface AttendanceRecord {
  id: string;
  userId: string;
  sessionId: string;
  courseId?: string;
  timestamp: string;
  status: 'PRESENT' | 'ABSENT' | 'LATE';
  deviceId?: string;
  user?: {
    id: string;
    name: string;
    email: string;
  };
  session?: {
    id: string;
    courseId: string;
    startTime: string;
    course?: {
      id: string;
      name: string;
      code: string;
    };
    teacher?: {
      id: string;
      name: string;
    };
  };
}

export interface Course {
  id: string;
  name: string;
  code: string;
  teacherId: string;
  schedule: string;
  location?: string;
  createdAt: string;
  teacher?: {
    id: string;
    name: string;
    email?: string;
  };
  _count?: {
    students: number;
    sessions?: number;
  };
  sessions?: AttendanceSession[];
}

export interface BLEDevice {
  id: string;
  name: string;
  rssi: number;
  isConnectable: boolean;
  serviceUUIDs: string[];
}

export interface AttendanceSession {
  id: string;
  courseId: string;
  teacherId: string;
  startTime: string;
  endTime?: string | null;
  isActive: boolean;
  beaconId?: string;
  course?: Course;
  teacher?: {
    id: string;
    name: string;
    email: string;
  };
  _count?: {
    attendance: number;
  };
  attendance?: AttendanceRecord[];
}

export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  TeacherDashboard: undefined;
  StudentHome: undefined;
};

export type BottomTabParamList = {
  Home: undefined;
  Courses: undefined;
  Profile: undefined;
};
