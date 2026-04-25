export interface User {
  id: string;
  email: string;
  name: string;
  role: 'teacher' | 'student';
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AttendanceRecord {
  id: string;
  userId: string;
  courseId: string;
  timestamp: string;
  status: 'present' | 'absent' | 'late';
  deviceId?: string;
}

export interface Course {
  id: string;
  name: string;
  code: string;
  teacherId: string;
  schedule: string;
  location?: string;
  createdAt: string;
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
  startTime: string;
  endTime: string;
  isActive: boolean;
  beaconId?: string;
}

export type RootStackParamList = {
  Login: undefined;
  TeacherDashboard: undefined;
  StudentHome: undefined;
};

export type BottomTabParamList = {
  Home: undefined;
  Courses: undefined;
  Profile: undefined;
};