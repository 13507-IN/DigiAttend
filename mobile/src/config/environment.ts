import { Platform } from 'react-native';

// Determine API URL based on platform
const getApiUrl = () => {
  if (Platform.OS === 'web') {
    // For web, use localhost
    return process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api';
  } else if (Platform.OS === 'android') {
    // For Android emulator, use special IP
    return process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:3000/api';
  } else {
    // For iOS simulator and real devices
    return process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api';
  }
};

export const API_BASE_URL = getApiUrl();
export const BLE_SERVICE_UUID = '4fafc201-1fb5-459e-8fcc-c5c9a3319248';
export const BLE_CHARACTERISTIC_UUID = 'beb5483e-36e1-4688-b7f5-ea07361b26a8';
export const BLE_DEVICE_NAME = 'DigiAttend-Beacon';
export const SCAN_TIMEOUT = 15000;
export const BLE_MANAGER_OPTIONS = {
  restoreStateIdentifier: 'com.digiattend.app.blemanager',
  forceBleTransport: undefined,
};
export const ENV = {
  development: {
    apiUrl: getApiUrl(),
  },
  production: {
    apiUrl: 'https://api.digiattend.com/api',
  },
};