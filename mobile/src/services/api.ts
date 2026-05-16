import axios, { AxiosInstance, AxiosError } from 'axios';
import { Platform } from 'react-native';
import { API_BASE_URL } from '../config/environment';
import { AuthResponse, LoginCredentials, User, AttendanceRecord, Course, RegisterCredentials } from '../types';

const TOKEN_KEY = 'digiattend_auth_token';
let SensitiveInfo: any = null;

// Conditionally import SensitiveInfo only for native platforms
if (Platform.OS !== 'web') {
  try {
    SensitiveInfo = require('react-native-sensitive-info').default;
  } catch (e) {
    console.warn('SensitiveInfo not available, using fallback storage');
  }
}

class ApiService {
  private client: AxiosInstance;
  private token: string | null = null;
  private isWeb: boolean = Platform.OS === 'web';

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.client.interceptors.request.use(
      (config) => {
        const token = this.getTokenSync();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        if (error.response?.status === 401) {
          this.clearToken();
        }
        return Promise.reject(error);
      }
    );
  }

  private getTokenSync(): string | null {
    if (this.token) return this.token;
    
    if (this.isWeb) {
      try {
        return typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
      } catch {
        return null;
      }
    }
    
    return this.token;
  }

  async getToken(): Promise<string | null> {
    if (this.token) return this.token;
    
    try {
      if (this.isWeb) {
        const token = typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
        this.token = token;
        return token;
      } else if (SensitiveInfo) {
        const token = await SensitiveInfo.getItem(TOKEN_KEY, {});
        this.token = token;
        return token;
      }
    } catch (error) {
      console.warn('Error retrieving token:', error);
    }
    
    return null;
  }

  async setToken(token: string): Promise<void> {
    this.token = token;
    
    try {
      if (this.isWeb) {
        if (typeof window !== 'undefined') {
          localStorage.setItem(TOKEN_KEY, token);
        }
      } else if (SensitiveInfo) {
        await SensitiveInfo.setItem(TOKEN_KEY, token, {
          keychainService: 'com.digiattend.app',
        });
      }
    } catch (error) {
      console.warn('Error setting token:', error);
    }
  }

  async clearToken(): Promise<void> {
    this.token = null;
    
    try {
      if (this.isWeb) {
        if (typeof window !== 'undefined') {
          localStorage.removeItem(TOKEN_KEY);
        }
      } else if (SensitiveInfo) {
        await SensitiveInfo.deleteItem(TOKEN_KEY, {});
      }
    } catch (error) {
      console.warn('Error clearing token:', error);
    }
  }

  setTokenDirect(token: string): void {
    this.token = token;
  }

  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const response = await this.client.post<AuthResponse>('/auth/login', credentials);
    const { token, user } = response.data;
    await this.setToken(token);
    return response.data;
  }

  async register(credentials: RegisterCredentials): Promise<AuthResponse> {
    const response = await this.client.post<AuthResponse>('/auth/register', credentials);
    const { token, user } = response.data;
    await this.setToken(token);
    return response.data;
  }

  async getCurrentUser(): Promise<User> {
    const response = await this.client.get<User>('/auth/me');
    return response.data;
  }

  async getTeacherCourses(teacherId: string): Promise<Course[]> {
    const response = await this.client.get<Course[]>(`/teachers/${teacherId}/courses`);
    return response.data;
  }

  async getStudentCourses(studentId: string): Promise<Course[]> {
    const response = await this.client.get<Course[]>(`/students/${studentId}/courses`);
    return response.data;
  }

  async recordAttendance(record: Partial<AttendanceRecord>): Promise<AttendanceRecord> {
    const response = await this.client.post<AttendanceRecord>('/attendance', record);
    return response.data;
  }

  async getAttendanceByCourse(courseId: string): Promise<AttendanceRecord[]> {
    const response = await this.client.get<AttendanceRecord[]>(`/attendance/course/${courseId}`);
    return response.data;
  }
}

export const apiService = new ApiService();
export default apiService;