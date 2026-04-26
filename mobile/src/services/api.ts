import axios, { AxiosInstance, AxiosError } from 'axios';
import SensitiveInfo from 'react-native-sensitive-info';
import { API_BASE_URL } from '../config/environment';
import { AuthResponse, LoginCredentials, User, AttendanceRecord, Course, RegisterCredentials } from '../types';

const TOKEN_KEY = 'digiattend_auth_token';

class ApiService {
  private client: AxiosInstance;
  private token: string | null = null;

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
    return this.token;
  }

  async getToken(): Promise<string | null> {
    if (this.token) return this.token;
    try {
      const token = await SensitiveInfo.getItem(TOKEN_KEY, {});
      this.token = token;
      return token;
    } catch {
      return null;
    }
  }

  async setToken(token: string): Promise<void> {
    this.token = token;
    await SensitiveInfo.setItem(TOKEN_KEY, token, {
      keychainService: 'com.digiattend.app',
    });
  }

  async clearToken(): Promise<void> {
    this.token = null;
    await SensitiveInfo.deleteItem(TOKEN_KEY, {});
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