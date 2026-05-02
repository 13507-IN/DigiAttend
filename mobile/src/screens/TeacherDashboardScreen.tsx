import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { bleService } from '../services/ble';
import { useAuth } from '../context/AuthContext';
import { RootStackParamList, BLEDevice } from '../types';

type TeacherDashboardProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'TeacherDashboard'>;
};

interface Course {
  id: string;
  name: string;
  code: string;
  schedule: string;
  studentCount: number;
}

export const TeacherDashboard: React.FC<TeacherDashboardProps> = ({ navigation }) => {
  const [isScanning, setIsScanning] = useState(false);
  const [devices, setDevices] = useState<BLEDevice[]>([]);
  const [activeSession, setActiveSession] = useState<string | null>(null);
  const [courses, setCourses] = useState<Course[]>([
    { id: '1', name: 'Computer Science 101', code: 'CS101', schedule: 'Mon/Wed 10:00 AM', studentCount: 25 },
    { id: '2', name: 'Data Structures', code: 'CS201', schedule: 'Tue/Thu 2:00 PM', studentCount: 30 },
    { id: '3', name: 'Algorithms', code: 'CS301', schedule: 'Mon/Wed 3:00 PM', studentCount: 20 },
  ]);
  const { logout, user } = useAuth();

  useEffect(() => {
    return () => {
      bleService.stopScanning();
    };
  }, []);

  const handleStartScanning = async () => {
    const hasPermissions = await bleService.requestPermissions();
    if (!hasPermissions) {
      Alert.alert('Permission Required', 'Bluetooth and location permissions are required for BLE scanning');
      return;
    }

    const isEnabled = await bleService.checkBluetoothEnabled();
    if (!isEnabled) {
      Alert.alert('Bluetooth Required', 'Please enable Bluetooth to scan for devices');
      return;
    }

    setDevices([]);
    setIsScanning(true);
    
    bleService.startScanning(
      (device) => {
        setDevices((prev) => {
          const exists = prev.find((d) => d.id === device.id);
          if (exists) return prev;
          return [...prev, device];
        });
      },
      (error) => {
        Alert.alert('Scan Error', error.message);
        setIsScanning(false);
      }
    );

    setTimeout(() => {
      setIsScanning(false);
    }, 15000);
  };

  const handleStopScanning = () => {
    bleService.stopScanning();
    setIsScanning(false);
  };

  const handleStartSession = async (courseId: string) => {
    if (!devices.length) {
      Alert.alert('No Devices', 'Please scan for BLE beacons first');
      return;
    }

    const hasPermissions = await bleService.requestPermissions();
    if (!hasPermissions) {
      Alert.alert('Permission Required', 'Bluetooth permissions are needed');
      return;
    }

    setActiveSession(courseId);
    Alert.alert('Session Started', 'Attendance session is now active');
  };

  const handleStopSession = () => {
    setActiveSession(null);
    Alert.alert('Session Ended', 'Attendance session has ended');
  };

  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await logout();
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Teacher Dashboard</Text>
            <Text style={styles.subtitle}>{user?.name}</Text>
          </View>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.bleSection}>
          <Text style={styles.sectionTitle}>BLE Attendance</Text>
          <Text style={styles.sectionSubtitle}>
            Scan for attendance beacons to start a session
          </Text>
          
          <View style={styles.scanStatus}>
            <Text style={styles.statusText}>
              {isScanning ? 'Scanning...' : 'Ready to scan'}
            </Text>
            <Text style={styles.deviceCount}>
              {devices.length} device{devices.length !== 1 ? 's' : ''} found
            </Text>
          </View>

          {isScanning ? (
            <TouchableOpacity
              style={[styles.scanButton, styles.stopButton]}
              onPress={handleStopScanning}
            >
              <ActivityIndicator color="#fff" />
              <Text style={styles.scanButtonText}>Stop Scanning</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.scanButton}
              onPress={handleStartScanning}
            >
              <Text style={styles.scanButtonText}>Start Scanning</Text>
            </TouchableOpacity>
          )}

          {devices.length > 0 && (
            <View style={styles.deviceList}>
              <Text style={styles.deviceListTitle}>Found Devices</Text>
              {devices.map((device) => (
                <View key={device.id} style={styles.deviceItem}>
                  <Text style={styles.deviceName}>{device.name}</Text>
                  <Text style={styles.deviceRSSI}>RSSI: {device.rssi}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={styles.coursesSection}>
          <Text style={styles.sectionTitle}>Your Courses</Text>
          
          {courses.map((course) => (
            <View key={course.id} style={styles.courseCard}>
              <View style={styles.courseInfo}>
                <Text style={styles.courseName}>{course.name}</Text>
                <Text style={styles.courseCode}>{course.code}</Text>
                <Text style={styles.courseSchedule}>{course.schedule}</Text>
                <Text style={styles.studentCount}>
                  {course.studentCount} students
                </Text>
              </View>
              <TouchableOpacity
                style={[
                  styles.sessionButton,
                  activeSession === course.id && styles.activeButton,
                ]}
                onPress={() => {
                  if (activeSession === course.id) {
                    handleStopSession();
                  } else {
                    handleStartSession(course.id);
                  }
                }}
              >
                <Text style={styles.sessionButtonText}>
                  {activeSession === course.id ? 'Stop Session' : 'Start Session'}
                </Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  logoutButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  logoutText: {
    color: '#dc2626',
    fontSize: 14,
    fontWeight: '600',
  },
  bleSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  scanStatus: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  statusText: {
    fontSize: 14,
    color: '#2563eb',
    fontWeight: '500',
  },
  deviceCount: {
    fontSize: 14,
    color: '#666',
  },
  scanButton: {
    backgroundColor: '#1a1a1a',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  stopButton: {
    backgroundColor: '#dc2626',
  },
  scanButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  deviceList: {
    marginTop: 16,
  },
  deviceListTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  deviceItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    marginBottom: 8,
  },
  deviceName: {
    fontSize: 14,
    color: '#1a1a1a',
  },
  deviceRSSI: {
    fontSize: 14,
    color: '#666',
  },
  coursesSection: {
    marginBottom: 24,
  },
  courseCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  courseInfo: {
    marginBottom: 12,
  },
  courseName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  courseCode: {
    fontSize: 14,
    color: '#2563eb',
    fontWeight: '500',
  },
  courseSchedule: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  studentCount: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  sessionButton: {
    backgroundColor: '#059669',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  activeButton: {
    backgroundColor: '#dc2626',
  },
  sessionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default TeacherDashboard;