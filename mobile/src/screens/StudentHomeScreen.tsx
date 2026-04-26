import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { bleService } from '../services/ble';
import { useAuth } from '../context/AuthContext';
import { RootStackParamList, BLEDevice } from '../types';

type StudentHomeProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'StudentHome'>;
};

interface Course {
  id: string;
  name: string;
  code: string;
  schedule: string;
  status?: 'available' | 'in-progress' | 'completed';
}

interface NearbySession {
  id: string;
  courseName: string;
  teacherName: string;
  timestamp: string;
}

export const StudentHome: React.FC<StudentHomeProps> = ({ navigation }) => {
  const [isScanning, setIsScanning] = useState(false);
  const [nearbySessions, setNearbySessions] = useState<NearbySession[]>([]);
  const [courses, setCourses] = useState<Course[]>([
    { id: '1', name: 'Computer Science 101', code: 'CS101', schedule: 'Mon/Wed 10:00 AM' },
    { id: '2', name: 'Data Structures', code: 'CS201', schedule: 'Tue/Thu 2:00 PM' },
  ]);
  const { logout, user } = useAuth();

  const [locationPermission, setLocationPermission] = useState<boolean>(false);

  const requestLocationPermission = async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Location Permission',
            message: 'DigiAttend needs location access for BLE scanning',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );
        setLocationPermission(granted === PermissionsAndroid.RESULTS.GRANTED);
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        console.warn(err);
        return false;
      }
    }
    return true;
  };

  useEffect(() => {
    requestLocationPermission();
    return () => {
      bleService.stopScanning();
    };
  }, []);

  const handleScanForAttendance = async () => {
    if (!locationPermission) {
      const granted = await requestLocationPermission();
      if (!granted) {
        Alert.alert('Permission Required', 'Location permission is required for BLE scanning');
        return;
      }
    }

    const hasPermissions = await bleService.requestPermissions();
    if (!hasPermissions) {
      Alert.alert('Permission Required', 'Bluetooth permissions are required');
      return;
    }

    setIsScanning(true);
    setNearbySessions([]);

    let scanComplete = false;

    bleService.startScanning(
      (device: BLEDevice) => {
        if (!scanComplete) {
          const session: NearbySession = {
            id: device.id,
            courseName: 'Active Attendance Session',
            teacherName: 'Prof. Smith',
            timestamp: new Date().toISOString(),
          };
          setNearbySessions((prev) => [...prev, session]);
        }
      },
      (error: Error) => {
        Alert.alert('Scan Error', error.message);
        setIsScanning(false);
      }
    );

    setTimeout(() => {
      bleService.stopScanning();
      setIsScanning(false);
      scanComplete = true;
      if (nearbySessions.length === 0) {
        Alert.alert('No Sessions', 'No attendance sessions found nearby');
      }
    }, 15000);
  };

  const handleMarkAttendance = async (session: NearbySession) => {
    Alert.alert(
      'Mark Attendance',
      `Mark yourself as present for ${session.courseName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: () => {
            Alert.alert('Success', 'Your attendance has been recorded');
            setNearbySessions((prev) => prev.filter((s) => s.id !== session.id));
          },
        },
      ]
    );
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
            <Text style={styles.title}>Student Home</Text>
            <Text style={styles.subtitle}>{user?.name}</Text>
          </View>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.scanSection}>
          <Text style={styles.sectionTitle}>Nearby Attendance</Text>
          <Text style={styles.sectionSubtitle}>
            Scan for active attendance sessions
          </Text>

          <TouchableOpacity
            style={[styles.scanButton, isScanning && styles.scanningButton]}
            onPress={handleScanForAttendance}
            disabled={isScanning}
          >
            <Text style={styles.scanButtonText}>
              {isScanning ? 'Scanning...' : 'Scan for Sessions'}
            </Text>
          </TouchableOpacity>

          {nearbySessions.length > 0 && (
            <View style={styles.sessionList}>
              <Text style={styles.sessionListTitle}>Available Sessions</Text>
              {nearbySessions.map((session) => (
                <View key={session.id} style={styles.sessionCard}>
                  <View style={styles.sessionInfo}>
                    <Text style={styles.sessionCourseName}>
                      {session.courseName}
                    </Text>
                    <Text style={styles.sessionTeacher}>
                      {session.teacherName}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.markButton}
                    onPress={() => handleMarkAttendance(session)}
                  >
                    <Text style={styles.markButtonText}>Check In</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={styles.coursesSection}>
          <Text style={styles.sectionTitle}>My Courses</Text>

          {courses.map((course) => (
            <View key={course.id} style={styles.courseCard}>
              <Text style={styles.courseName}>{course.name}</Text>
              <Text style={styles.courseCode}>{course.code}</Text>
              <Text style={styles.courseSchedule}>{course.schedule}</Text>
            </View>
          ))}
        </View>

        <View style={styles.infoSection}>
          <Text style={styles.infoTitle}>How it works</Text>
          <View style={styles.infoItem}>
            <Text style={styles.infoNumber}>1</Text>
            <Text style={styles.infoText}>
              Tap "Scan for Sessions" to find nearby attendance beacons
            </Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoNumber}>2</Text>
            <Text style={styles.infoText}>
              When you find a session, tap "Check In" to record your attendance
            </Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoNumber}>3</Text>
            <Text style={styles.infoText}>
              Stay within range of the beacon until attendance is confirmed
            </Text>
          </View>
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
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
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
  scanSection: {
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
  scanButton: {
    backgroundColor: '#1a1a1a',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  scanningButton: {
    backgroundColor: '#2563eb',
  },
  scanButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  sessionList: {
    marginTop: 16,
  },
  sessionListTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  sessionCard: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sessionInfo: {
    flex: 1,
  },
  sessionCourseName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  sessionTeacher: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  markButton: {
    backgroundColor: '#059669',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  markButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
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
  courseName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  courseCode: {
    fontSize: 14,
    color: '#2563eb',
    fontWeight: '500',
    marginTop: 4,
  },
  courseSchedule: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  infoSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 12,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  infoNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#1a1a1a',
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 24,
    marginRight: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
});

export default StudentHome;