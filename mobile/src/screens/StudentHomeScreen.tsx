import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
  PermissionsAndroid,
  Platform,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { bleService } from '../services/ble';
import { apiService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { RootStackParamList, Course, AttendanceSession, AttendanceRecord, BLEDevice } from '../types';

type StudentHomeProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'StudentHome'>;
};

export const StudentHome: React.FC<StudentHomeProps> = ({ navigation }) => {
  const { logout, user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isScanning, setIsScanning] = useState(false);

  const [courses, setCourses] = useState<Course[]>([]);
  const [activeSessions, setActiveSessions] = useState<AttendanceSession[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [totalAttended, setTotalAttended] = useState(0);

  const [nearbyDevices, setNearbyDevices] = useState<BLEDevice[]>([]);
  const [markingSessionId, setMarkingSessionId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'attendance' | 'courses' | 'history'>('attendance');

  // Load student data
  const loadData = useCallback(async () => {
    if (!user?.id) return;
    try {
      const [studentCourses, liveSessions, myAttendance] = await Promise.all([
        apiService.getStudentCourses(user.id),
        apiService.getActiveSessions(),
        apiService.getMyAttendance(),
      ]);

      setCourses(studentCourses);
      setActiveSessions(liveSessions);
      setAttendanceRecords(myAttendance.records || []);
      setTotalAttended(myAttendance.totalAttended || 0);
    } catch (error) {
      console.warn('Failed to load student data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadData();
    return () => {
      bleService.stopScanning();
    };
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  // BLE Scan
  const handleScanForAttendance = async () => {
    // 1. Check bluetooth permissions
    const hasPerms = await bleService.requestPermissions();
    if (!hasPerms) {
      Alert.alert('Permission Required', 'Bluetooth and location permissions are needed to detect classroom beacons.');
      return;
    }

    const isEnabled = await bleService.checkBluetoothEnabled();
    if (!isEnabled) {
      Alert.alert('Bluetooth Disabled', 'Please enable Bluetooth to scan for classroom attendance beacons.');
      return;
    }

    setIsScanning(true);
    setNearbyDevices([]);

    // Refresh active sessions from backend simultaneously
    try {
      const liveSessions = await apiService.getActiveSessions();
      setActiveSessions(liveSessions);
    } catch (e) {
      console.warn('Could not refresh active sessions:', e);
    }

    bleService.startScanning(
      (device) => {
        setNearbyDevices((prev) => {
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
    }, 10000);
  };

  // Mark Attendance via API
  const handleMarkAttendance = async (session: AttendanceSession) => {
    const courseTitle = session.course?.name || 'Class Session';
    const courseCode = session.course?.code || '';

    Alert.alert(
      'Confirm Attendance',
      `Mark attendance for ${courseTitle} (${courseCode})?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            try {
              setMarkingSessionId(session.id);
              const deviceId = nearbyDevices[0]?.id || (Platform.OS === 'web' ? 'WEB_CLIENT' : 'MOBILE_BLE');
              const res = await apiService.recordAttendance({
                sessionId: session.id,
                deviceId,
              });

              Alert.alert('Success! 🎉', res.message || 'Your attendance has been recorded successfully.');
              loadData();
            } catch (error: any) {
              const msg = error.response?.data?.message || 'Failed to record attendance';
              Alert.alert('Attendance Notice', msg);
            } finally {
              setMarkingSessionId(null);
            }
          },
        },
      ]
    );
  };

  // Logout
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

  // Check if student has already attended a session
  const hasAttendedSession = (sessionId: string) => {
    return attendanceRecords.some((record) => record.sessionId === sessionId);
  };

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
                {user?.name ? user.name.charAt(0).toUpperCase() : 'S'}
              </Text>
            </View>
            <View>
              <Text style={styles.greeting}>Student Portal</Text>
              <Text style={styles.userName}>{user?.name || 'Student'}</Text>
              <View style={styles.roleTag}>
                <Text style={styles.roleTagText}>STUDENT</Text>
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
            <Text style={styles.statNumber}>{totalAttended}</Text>
            <Text style={styles.statLabel}>Attended</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{courses.length}</Text>
            <Text style={styles.statLabel}>Enrolled</Text>
          </View>
          <View style={[styles.statCard, activeSessions.length > 0 ? styles.statCardActive : null]}>
            <Text
              style={[
                styles.statNumber,
                activeSessions.length > 0 ? styles.statNumberActive : null,
              ]}
            >
              {activeSessions.length}
            </Text>
            <Text style={styles.statLabel}>Live Classes</Text>
          </View>
        </View>

        {/* Navigation Tabs */}
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'attendance' && styles.tabButtonActive]}
            onPress={() => setActiveTab('attendance')}
          >
            <Text
              style={[styles.tabText, activeTab === 'attendance' && styles.tabTextActive]}
            >
              📡 Check-in
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'courses' && styles.tabButtonActive]}
            onPress={() => setActiveTab('courses')}
          >
            <Text style={[styles.tabText, activeTab === 'courses' && styles.tabTextActive]}>
              📚 Courses
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'history' && styles.tabButtonActive]}
            onPress={() => setActiveTab('history')}
          >
            <Text style={[styles.tabText, activeTab === 'history' && styles.tabTextActive]}>
              🕒 History
            </Text>
          </TouchableOpacity>
        </View>

        {/* TAB 1: Attendance Check-in */}
        {activeTab === 'attendance' && (
          <View style={styles.tabContent}>
            {/* BLE Scan Button Card */}
            <View style={styles.scannerCard}>
              <Text style={styles.scannerTitle}>Bluetooth Attendance Scanner</Text>
              <Text style={styles.scannerSubtitle}>
                Ensure you are in the classroom. Tap scan to detect the teacher's beacon.
              </Text>

              <TouchableOpacity
                style={[styles.scanButton, isScanning && styles.scanningButton]}
                onPress={isScanning ? () => bleService.stopScanning() : handleScanForAttendance}
                disabled={isScanning}
              >
                {isScanning ? (
                  <View style={styles.scanningRow}>
                    <ActivityIndicator color="#FFFFFF" size="small" />
                    <Text style={styles.scanButtonText}>Scanning for Beacons...</Text>
                  </View>
                ) : (
                  <Text style={styles.scanButtonText}>📡 Scan for Active Session</Text>
                )}
              </TouchableOpacity>

              {nearbyDevices.length > 0 && (
                <Text style={styles.detectedCount}>
                  ✓ Detected {nearbyDevices.length} BLE signal(s) in proximity
                </Text>
              )}
            </View>

            {/* Active Sessions List */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Active Classroom Sessions</Text>
              {activeSessions.length > 0 && (
                <View style={styles.liveBadge}>
                  <Text style={styles.liveBadgeText}>● {activeSessions.length} LIVE NOW</Text>
                </View>
              )}
            </View>

            {loading ? (
              <ActivityIndicator size="large" color="#4F46E5" style={{ marginVertical: 20 }} />
            ) : activeSessions.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyIcon}>⏳</Text>
                <Text style={styles.emptyTitle}>No Active Sessions Right Now</Text>
                <Text style={styles.emptySub}>
                  When your instructor starts a class session, it will show up here.
                </Text>
              </View>
            ) : (
              activeSessions.map((session) => {
                const attended = hasAttendedSession(session.id);
                const isMarking = markingSessionId === session.id;

                return (
                  <View key={session.id} style={styles.sessionCard}>
                    <View style={styles.sessionHeader}>
                      <View style={styles.codeBadge}>
                        <Text style={styles.codeBadgeText}>
                          {session.course?.code || 'CLASS'}
                        </Text>
                      </View>
                      <View style={styles.livePulseBadge}>
                        <Text style={styles.livePulseText}>LIVE</Text>
                      </View>
                    </View>

                    <Text style={styles.sessionCourseName}>
                      {session.course?.name || 'Class Session'}
                    </Text>
                    <Text style={styles.sessionTeacher}>
                      Instructor: {session.teacher?.name || 'Faculty Member'}
                    </Text>
                    <Text style={styles.sessionBeacon}>
                      Beacon: {session.beaconId || 'DigiAttend-Beacon'}
                    </Text>

                    <View style={styles.sessionActionBox}>
                      {attended ? (
                        <View style={styles.attendedBadge}>
                          <Text style={styles.attendedText}>✓ Attendance Marked</Text>
                        </View>
                      ) : (
                        <TouchableOpacity
                          style={styles.markPresentButton}
                          onPress={() => handleMarkAttendance(session)}
                          disabled={isMarking}
                        >
                          {isMarking ? (
                            <ActivityIndicator color="#FFFFFF" size="small" />
                          ) : (
                            <Text style={styles.markPresentText}>✓ Mark Present</Text>
                          )}
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                );
              })
            )}
          </View>
        )}

        {/* TAB 2: Courses */}
        {activeTab === 'courses' && (
          <View style={styles.tabContent}>
            <Text style={styles.sectionTitle}>My Enrolled Courses</Text>
            {courses.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyIcon}>📚</Text>
                <Text style={styles.emptyTitle}>Not enrolled in any courses</Text>
                <Text style={styles.emptySub}>
                  When you check in to an active session, you will be enrolled automatically!
                </Text>
              </View>
            ) : (
              courses.map((course) => (
                <View key={course.id} style={styles.courseCard}>
                  <View style={styles.codeRow}>
                    <View style={styles.codeBadge}>
                      <Text style={styles.codeBadgeText}>{course.code}</Text>
                    </View>
                  </View>
                  <Text style={styles.courseName}>{course.name}</Text>
                  <Text style={styles.courseSchedule}>🗓 {course.schedule}</Text>
                  {course.location && (
                    <Text style={styles.courseLocation}>📍 {course.location}</Text>
                  )}
                  {course.teacher && (
                    <Text style={styles.courseTeacher}>👨‍🏫 Instructor: {course.teacher.name}</Text>
                  )}
                </View>
              ))
            )}
          </View>
        )}

        {/* TAB 3: History */}
        {activeTab === 'history' && (
          <View style={styles.tabContent}>
            <Text style={styles.sectionTitle}>Attendance History</Text>
            {attendanceRecords.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyIcon}>📋</Text>
                <Text style={styles.emptyTitle}>No Attendance Records Yet</Text>
                <Text style={styles.emptySub}>
                  Your confirmed check-ins will appear here with timestamps.
                </Text>
              </View>
            ) : (
              attendanceRecords.map((record) => (
                <View key={record.id} style={styles.historyCard}>
                  <View style={styles.historyTop}>
                    <Text style={styles.historyCourse}>
                      {record.session?.course?.name || 'Class Session'}
                    </Text>
                    <View style={styles.statusBadge}>
                      <Text style={styles.statusText}>{record.status}</Text>
                    </View>
                  </View>
                  <Text style={styles.historyCode}>
                    {record.session?.course?.code || 'Course'}
                  </Text>
                  <Text style={styles.historyTime}>
                    📅 {new Date(record.timestamp).toLocaleDateString()} at{' '}
                    {new Date(record.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                </View>
              ))
            )}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

export default StudentHome;

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
    backgroundColor: '#059669',
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
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  roleTagText: {
    color: '#059669',
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
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: '#E2E8F0',
    borderRadius: 10,
    padding: 3,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabButtonActive: {
    backgroundColor: '#FFFFFF',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  tabTextActive: {
    color: '#0F172A',
    fontWeight: '700',
  },
  tabContent: {
    paddingHorizontal: 16,
    marginTop: 16,
  },
  scannerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 20,
  },
  scannerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  scannerSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 4,
    marginBottom: 14,
  },
  scanButton: {
    backgroundColor: '#4F46E5',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  scanningButton: {
    backgroundColor: '#6366F1',
  },
  scanningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  scanButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  detectedCount: {
    color: '#059669',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 10,
    textAlign: 'center',
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
    marginBottom: 10,
  },
  liveBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  liveBadgeText: {
    color: '#15803D',
    fontSize: 11,
    fontWeight: '700',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    padding: 28,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyIcon: {
    fontSize: 32,
    marginBottom: 8,
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
  },
  sessionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
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
  livePulseBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  livePulseText: {
    color: '#15803D',
    fontSize: 11,
    fontWeight: '700',
  },
  sessionCourseName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
  },
  sessionTeacher: {
    fontSize: 13,
    color: '#475569',
    marginTop: 4,
  },
  sessionBeacon: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  sessionActionBox: {
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 12,
  },
  markPresentButton: {
    backgroundColor: '#059669',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  markPresentText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  attendedBadge: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#86EFAC',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  attendedText: {
    color: '#16A34A',
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
  codeRow: {
    flexDirection: 'row',
    marginBottom: 6,
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
  courseTeacher: {
    fontSize: 12,
    color: '#4F46E5',
    marginTop: 4,
    fontWeight: '500',
  },
  historyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  historyTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  historyCourse: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  statusBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusText: {
    color: '#15803D',
    fontWeight: '700',
    fontSize: 11,
  },
  historyCode: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  historyTime: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 6,
  },
});
