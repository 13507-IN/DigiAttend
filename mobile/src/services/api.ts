import axios, { AxiosInstance, AxiosError } from 'axios';
import { API_BASE_URL } from '../config/environment';
import { AuthResponse, LoginCredentials, User, AttendanceRecord, Course } from '../types';

class ApiService {
  private client: AxiosInstance;

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
        const token = this.getToken();
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

  private getToken(): string | null {
    return null;
  }

  private clearToken(): void {
  }

  setToken(token: string): void {
    this.client.defaults.headers.common.Authorization = `Bearer ${token}`;
  }

  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const response = await this.client.post<AuthResponse>('/auth/login', credentials);
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