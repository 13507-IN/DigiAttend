import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
  RefreshControl,
  Modal,
  TextInput,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { bleService } from '../services/ble';
import { apiService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { RootStackParamList, Course, AttendanceSession, AttendanceRecord, BLEDevice } from '../types';

type TeacherDashboardProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'TeacherDashboard'>;
};

export const TeacherDashboard: React.FC<TeacherDashboardProps> = ({ navigation }) => {
  const { logout, user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);
  const [activeSession, setActiveSession] = useState<AttendanceSession | null>(null);
  const [attendees, setAttendees] = useState<AttendanceRecord[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [devices, setDevices] = useState<BLEDevice[]>([]);

  // Create Course Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newCourseName, setNewCourseName] = useState('');
  const [newCourseCode, setNewCourseCode] = useState('');
  const [newCourseSchedule, setNewCourseSchedule] = useState('');
  const [newCourseLocation, setNewCourseLocation] = useState('');
  const [creatingCourse, setCreatingCourse] = useState(false);

  // Polling ref for live attendance updates
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

  const loadData = useCallback(async () => {
    if (!user?.id) return;
    try {
      const teacherCourses = await apiService.getTeacherCourses(user.id);
      setCourses(teacherCourses);

      // Check if any course has an active session
      const courseWithActiveSession = teacherCourses.find(
        (c) => c.sessions && c.sessions.length > 0 && c.sessions[0].isActive
      );

      if (courseWithActiveSession && courseWithActiveSession.sessions?.[0]) {
        const session = courseWithActiveSession.sessions[0];
        setActiveSession(session);
        fetchSessionAttendees(session.id);
      } else {
        // Double check active sessions endpoint
        const allActive = await apiService.getActiveSessions();
        const myActive = allActive.find((s) => s.teacherId === user.id);
        if (myActive) {
          setActiveSession(myActive);
          fetchSessionAttendees(myActive.id);
        } else {
          setActiveSession(null);
          setAttendees([]);
        }
      }
    } catch (error) {
      console.warn('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  const fetchSessionAttendees = async (sessionId: string) => {
    try {
      const details = await apiService.getSessionAttendance(sessionId);
      if (details?.attendance) {
        setAttendees(details.attendance);
      }
    } catch (e) {
      console.warn('Failed to fetch session attendees:', e);
    }
  };

  useEffect(() => {
    loadData();
    return () => {
      bleService.stopScanning();
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [loadData]);

  // Periodic poll for live student arrivals when session is active
  useEffect(() => {
    if (activeSession?.id) {
      pollTimerRef.current = setInterval(() => {
        fetchSessionAttendees(activeSession.id);
      }, 5000);
    } else {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    }
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [activeSession?.id]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  // Start BLE Session
  const handleStartSession = async (course: Course) => {
    try {
      setLoading(true);
      const session = await apiService.startSession(course.id, `BEACON-${course.code}`);
      setActiveSession(session);
      setAttendees([]);
      Alert.alert(
        'Session Started! 📡',
        `Attendance session for "${course.name}" (${course.code}) is now LIVE. Students can scan and check in.`
      );
      loadData();
    } catch (error: any) {
      const msg = error.response?.data?.message || 'Failed to start session';
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  };

  // Stop Session
  const handleStopSession = async () => {
    if (!activeSession) return;
    try {
      setLoading(true);
      await apiService.stopSession(activeSession.id);
      Alert.alert(
        'Session Closed',
        `Attendance session concluded. Total present: ${attendees.length} student(s).`
      );
      setActiveSession(null);
      setAttendees([]);
      loadData();
    } catch (error: any) {
      const msg = error.response?.data?.message || 'Failed to stop session';
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  };

  // Create Course
  const handleCreateCourse = async () => {
    if (!newCourseName.trim() || !newCourseCode.trim() || !newCourseSchedule.trim()) {
      Alert.alert('Missing Fields', 'Please enter course name, code, and schedule.');
      return;
    }

    try {
      setCreatingCourse(true);
      await apiService.createCourse({
        name: newCourseName.trim(),
        code: newCourseCode.trim().toUpperCase(),
        schedule: newCourseSchedule.trim(),
        location: newCourseLocation.trim() || undefined,
      });

      setShowCreateModal(false);
      setNewCourseName('');
      setNewCourseCode('');
      setNewCourseSchedule('');
      setNewCourseLocation('');
      Alert.alert('Success', 'Course created successfully!');
      loadData();
    } catch (error: any) {
      const msg = error.response?.data?.message || 'Failed to create course';
      Alert.alert('Error', msg);
    } finally {
      setCreatingCourse(false);
    }
  };

  // BLE Scan for physical beacons or testing
  const handleScanBeacons = async () => {
    const hasPerms = await bleService.requestPermissions();
    if (!hasPerms) {
      Alert.alert('Permission Required', 'Bluetooth permissions are required for BLE scanning');
      return;
    }
    const isEnabled = await bleService.checkBluetoothEnabled();
    if (!isEnabled) {
      Alert.alert('Bluetooth Disabled', 'Please enable Bluetooth to scan for beacon devices.');
      return;
    }

    setDevices([]);
    setIsScanning(true);

    bleService.startScanning(
      (device) => {
        setDevices((prev) => {
          if (prev.some((d) => d.id === device.id)) return prev;
          return [...prev, device];
        });
      },
      (error) => {
        Alert.alert('Scan Notice', error.message);
        setIsScanning(false);
      }
    );

    setTimeout(() => {
      bleService.stopScanning();
      setIsScanning(false);
    }, 8000);
  };

  const handleLogout = async () => {
    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to logout?')) {
        await logout();
      }
    } else {
      Alert.alert('Logout', 'Are you sure you want to logout?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Logout', style: 'destructive', onPress: async () => await logout() },
      ]);
    }
  };

  const totalStudents = courses.reduce((acc, c) => acc + (c._count?.students || 0), 0);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Header Bar */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {user?.name ? user.name.charAt(0).toUpperCase() : 'T'}
              </Text>
            </View>
            <View>
              <Text style={styles.greeting}>Welcome back,</Text>
              <Text style={styles.userName}>{user?.name || 'Teacher'}</Text>
              <View style={styles.roleTag}>
                <Text style={styles.roleTagText}>TEACHER</Text>
              </View>
            </View>
          </View>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>

        {/* Quick Stat Cards */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{courses.length}</Text>
            <Text style={styles.statLabel}>Courses</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{totalStudents}</Text>
            <Text style={styles.statLabel}>Enrolled</Text>
          </View>
          <View style={[styles.statCard, activeSession ? styles.statCardActive : null]}>
            <Text style={[styles.statNumber, activeSession ? styles.statNumberActive : null]}>
              {activeSession ? '1' : '0'}
            </Text>
            <Text style={styles.statLabel}>Live Session</Text>
          </View>
        </View>

        {/* Live Active Session Banner */}
        {activeSession && (
          <View style={styles.liveBanner}>
            <View style={styles.liveBannerHeader}>
              <View style={styles.pulseDot} />
              <Text style={styles.liveBannerTitle}>LIVE ATTENDANCE SESSION</Text>
            </View>
            <Text style={styles.liveCourseName}>
              {activeSession.course?.name || 'Active Session'} ({activeSession.course?.code})
            </Text>
            <Text style={styles.liveBeaconInfo}>
              Beacon ID: {activeSession.beaconId || 'DigiAttend-Beacon'}
            </Text>

            {/* Live Count and Attendees */}
            <View style={styles.attendeeCounterBox}>
              <Text style={styles.attendeeCounterText}>
                👥 {attendees.length} Student{attendees.length === 1 ? '' : 's'} Marked Present
              </Text>
            </View>

            {attendees.length > 0 && (
              <View style={styles.attendeeList}>
                <Text style={styles.attendeeListTitle}>Recent Check-ins:</Text>
                {attendees.slice(0, 5).map((att) => (
                  <View key={att.id} style={styles.attendeeItem}>
                    <Text style={styles.attendeeName}>{att.user?.name || 'Student'}</Text>
                    <Text style={styles.attendeeTime}>
                      {new Date(att.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            <TouchableOpacity style={styles.stopSessionButton} onPress={handleStopSession}>
              <Text style={styles.stopSessionText}>⏹ Stop Session</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Courses Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>My Courses</Text>
            <TouchableOpacity
              style={styles.addCourseButton}
              onPress={() => setShowCreateModal(true)}
            >
              <Text style={styles.addCourseText}>+ New Course</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator size="large" color="#4F46E5" style={{ marginVertical: 20 }} />
          ) : courses.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No courses found</Text>
              <Text style={styles.emptySub}>
                Create your first course to start broadcasting BLE sessions.
              </Text>
              <TouchableOpacity
                style={styles.primaryActionButton}
                onPress={() => setShowCreateModal(true)}
              >
                <Text style={styles.primaryActionText}>+ Create Course</Text>
              </TouchableOpacity>
            </View>
          ) : (
            courses.map((course) => {
              const isThisActive = activeSession?.courseId === course.id;
              return (
                <View key={course.id} style={styles.courseCard}>
                  <View style={styles.courseTop}>
                    <View>
                      <View style={styles.codeRow}>
                        <View style={styles.codeBadge}>
                          <Text style={styles.codeBadgeText}>{course.code}</Text>
                        </View>
                        {isThisActive && (
                          <View style={styles.activePill}>
                            <Text style={styles.activePillText}>● LIVE</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.courseName}>{course.name}</Text>
                      <Text style={styles.courseSchedule}>🗓 {course.schedule}</Text>
                      {course.location && (
                        <Text style={styles.courseLocation}>📍 {course.location}</Text>
                      )}
                    </View>
                  </View>

                  <View style={styles.courseFooter}>
                    <Text style={styles.studentCount}>
                      👥 {course._count?.students || 0} Students
                    </Text>
                    {isThisActive ? (
                      <TouchableOpacity
                        style={styles.endSmallButton}
                        onPress={handleStopSession}
                      >
                        <Text style={styles.endSmallText}>End Session</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        style={[
                          styles.startSmallButton,
                          activeSession ? styles.disabledButton : null,
                        ]}
                        disabled={!!activeSession}
                        onPress={() => handleStartSession(course)}
                      >
                        <Text style={styles.startSmallText}>▶ Start Session</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </View>

        {/* BLE Diagnostic / Hardware Tools */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>BLE Beacon Diagnostics</Text>
          <Text style={styles.sectionSubtitle}>
            Scan nearby BLE hardware beacons or verify Bluetooth broadcaster availability.
          </Text>
          <TouchableOpacity
            style={[styles.scanButton, isScanning && styles.scanningButton]}
            onPress={isScanning ? () => bleService.stopScanning() : handleScanBeacons}
            disabled={isScanning}
          >
            {isScanning ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.scanButtonText}>🔍 Scan for Nearby BLE Devices</Text>
            )}
          </TouchableOpacity>

          {devices.length > 0 && (
            <View style={styles.deviceList}>
              <Text style={styles.deviceListHeader}>Detected Devices ({devices.length}):</Text>
              {devices.map((d) => (
                <View key={d.id} style={styles.deviceItem}>
                  <Text style={styles.deviceName}>{d.name || 'Unnamed Device'}</Text>
                  <Text style={styles.deviceRssi}>{d.rssi} dBm</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Create Course Modal */}
      <Modal visible={showCreateModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Create New Course</Text>
            <Text style={styles.modalSub}>
              Enter course details to enable attendance tracking.
            </Text>

            <TextInput
              style={styles.modalInput}
              placeholder="Course Name (e.g. Data Structures)"
              placeholderTextColor="#9CA3AF"
              value={newCourseName}
              onChangeText={setNewCourseName}
            />

            <TextInput
              style={styles.modalInput}
              placeholder="Course Code (e.g. CS201)"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="characters"
              value={newCourseCode}
              onChangeText={setNewCourseCode}
            />

            <TextInput
              style={styles.modalInput}
              placeholder="Schedule (e.g. Mon/Wed 10:00 AM)"
              placeholderTextColor="#9CA3AF"
              value={newCourseSchedule}
              onChangeText={setNewCourseSchedule}
            />

            <TextInput
              style={styles.modalInput}
              placeholder="Room / Location (Optional, e.g. Room 304)"
              placeholderTextColor="#9CA3AF"
              value={newCourseLocation}
              onChangeText={setNewCourseLocation}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelModalButton}
                onPress={() => setShowCreateModal(false)}
              >
                <Text style={styles.cancelModalText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveModalButton}
                onPress={handleCreateCourse}
                disabled={creatingCourse}
              >
                {creatingCourse ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.saveModalText}>Create Course</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default TeacherDashboard;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 40 : 16,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#4F46E5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 18,
  },
  greeting: {
    fontSize: 12,
    color: '#64748B',
  },
  userName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  roleTag: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  roleTagText: {
    color: '#4F46E5',
    fontSize: 10,
    fontWeight: '700',
  },
  logoutButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  logoutText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statCardActive: {
    borderColor: '#10B981',
    backgroundColor: '#ECFDF5',
  },
  statNumber: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0F172A',
  },
  statNumberActive: {
    color: '#059669',
  },
  statLabel: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  liveBanner: {
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    backgroundColor: '#064E3B',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#059669',
  },
  liveBannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  pulseDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#34D399',
    marginRight: 8,
  },
  liveBannerTitle: {
    color: '#34D399',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  liveCourseName: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  liveBeaconInfo: {
    color: '#A7F3D0',
    fontSize: 12,
    marginTop: 2,
  },
  attendeeCounterBox: {
    marginTop: 12,
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  attendeeCounterText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  attendeeList: {
    marginTop: 10,
    backgroundColor: 'rgba(0,0,0,0.18)',
    borderRadius: 8,
    padding: 10,
  },
  attendeeListTitle: {
    color: '#D1FAE5',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  attendeeItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  attendeeName: {
    color: '#FFFFFF',
    fontSize: 13,
  },
  attendeeTime: {
    color: '#6EE7B7',
    fontSize: 12,
  },
  stopSessionButton: {
    marginTop: 14,
    backgroundColor: '#EF4444',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  stopSessionText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  section: {
    paddingHorizontal: 16,
    marginTop: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 10,
  },
  addCourseButton: {
    backgroundColor: '#EEF2FF',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  addCourseText: {
    color: '#4F46E5',
    fontSize: 13,
    fontWeight: '700',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
  },
  emptySub: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 16,
  },
  primaryActionButton: {
    backgroundColor: '#4F46E5',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  primaryActionText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  courseCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  courseTop: {
    marginBottom: 12,
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  codeBadge: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  codeBadgeText: {
    color: '#4F46E5',
    fontWeight: '700',
    fontSize: 12,
  },
  activePill: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  activePillText: {
    color: '#15803D',
    fontSize: 11,
    fontWeight: '700',
  },
  courseName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  courseSchedule: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 4,
  },
  courseLocation: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  courseFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 12,
  },
  studentCount: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  startSmallButton: {
    backgroundColor: '#4F46E5',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  startSmallText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  endSmallButton: {
    backgroundColor: '#EF4444',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  endSmallText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  disabledButton: {
    opacity: 0.5,
  },
  scanButton: {
    backgroundColor: '#0F172A',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 4,
  },
  scanningButton: {
    backgroundColor: '#475569',
  },
  scanButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  deviceList: {
    marginTop: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  deviceListHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 8,
  },
  deviceItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  deviceName: {
    fontSize: 13,
    color: '#0F172A',
  },
  deviceRssi: {
    fontSize: 12,
    color: '#64748B',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  modalSub: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 4,
    marginBottom: 16,
  },
  modalInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
    marginBottom: 12,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 8,
  },
  cancelModalButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  cancelModalText: {
    color: '#64748B',
    fontWeight: '600',
    fontSize: 14,
  },
  saveModalButton: {
    backgroundColor: '#4F46E5',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  saveModalText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
});
