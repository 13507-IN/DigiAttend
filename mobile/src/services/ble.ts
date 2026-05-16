import { Platform, PermissionsAndroid, Alert } from 'react-native';
import {
  BLE_SERVICE_UUID,
  BLE_CHARACTERISTIC_UUID,
  BLE_DEVICE_NAME,
  SCAN_TIMEOUT,
  BLE_MANAGER_OPTIONS,
} from '../config/environment';
import { BLEDevice } from '../types';

let BleManager: any = null;
let Device: any = null;
let Characteristic: any = null;

// Only import BLE packages on native platforms
if (Platform.OS !== 'web') {
  try {
    const ble = require('react-native-ble-plx');
    BleManager = ble.BleManager;
    Device = ble.Device;
    Characteristic = ble.Characteristic;
  } catch (error) {
    console.warn('BLE packages not available:', error);
  }
}

class BLEService {
  private bleManager: any = null;
  private isScanning: boolean = false;
  private scannedDevices: Map<string, BLEDevice> = new Map();
  private isWebPlatform: boolean = Platform.OS === 'web';

  constructor() {
    if (!this.isWebPlatform && BleManager) {
      this.bleManager = new BleManager(BLE_MANAGER_OPTIONS);
    }
  }

  getManager(): any {
    if (this.isWebPlatform) {
      console.warn('BLE Manager is not available on web platform');
      return null;
    }
    return this.bleManager;
  }

  async requestPermissions(): Promise<boolean> {
    // Web platform doesn't require BLE permissions
    if (this.isWebPlatform) {
      return true;
    }

    if (Platform.OS === 'android') {
      const androidVersion = Platform.Version;
      if (androidVersion >= 31) {
        const permissions = [
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        ];
        const granted = await PermissionsAndroid.requestMultiple(permissions);
        return Object.values(granted).every(
          (status) => status === PermissionsAndroid.RESULTS.GRANTED
        );
      } else {
        const permissions = [
          PermissionsAndroid.PERMISSIONS.BLUETOOTH,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADMIN,
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        ];
        const granted = await PermissionsAndroid.requestMultiple(permissions);
        return Object.values(granted).every(
          (status) => status === PermissionsAndroid.RESULTS.GRANTED
        );
      }
    }
    return true;
  }

  async checkBluetoothEnabled(): Promise<boolean> {
    // On web, we can't check Bluetooth status
    if (this.isWebPlatform) {
      return true; // Assume it's available on web
    }

    if (!this.bleManager) return false;

    try {
      const state = await this.bleManager.state();
      return state === 'PoweredOn';
    } catch (error) {
      console.error('Error checking Bluetooth state:', error);
      return false;
    }
  }

  startScanning(
    onDeviceFound: (device: BLEDevice) => void,
    onError?: (error: Error) => void
  ): void {
    // On web, don't actually scan but allow the UI to proceed
    if (this.isWebPlatform) {
      console.info('BLE scanning not available on web platform');
      return;
    }

    if (this.isScanning || !this.bleManager) return;

    this.isScanning = true;
    this.scannedDevices.clear();

    const filterServiceUUIDs = [BLE_SERVICE_UUID];

    this.bleManager.startDeviceScan(
      filterServiceUUIDs,
      { allowDuplicates: false },
      (error: any, device: any) => {
        if (error) {
          console.error('BLE Scan Error:', error);
          onError?.(new Error(error.message));
          this.stopScanning();
          return;
        }

        if (device) {
          const bleDevice: BLEDevice = {
            id: device.id,
            name: device.name || 'Unknown Device',
            rssi: device.rssi || 0,
            services: [],
          };
          if (!this.scannedDevices.has(device.id)) {
            this.scannedDevices.set(device.id, bleDevice);
            onDeviceFound(bleDevice);
          }
        }
      }
    );

    setTimeout(() => {
      this.stopScanning();
    }, SCAN_TIMEOUT);
  }

  stopScanning(): void {
    if (this.isScanning && !this.isWebPlatform && this.bleManager) {
      this.bleManager.stopDeviceScan();
    }
    this.isScanning = false;
  }

  async connectToDevice(deviceId: string): Promise<any | null> {
    if (this.isWebPlatform || !this.bleManager) {
      console.warn('BLE connection not available on web platform');
      return null;
    }

    try {
      const device = await this.bleManager.connectToDevice(deviceId, {
        timeout: 10000,
      });
      await device.discoverAllServicesAndCharacteristics();
      return device;
    } catch (error) {
      console.error('Connection Error:', error);
      return null;
    }
  }

  async disconnectDevice(deviceId: string): Promise<void> {
    if (this.isWebPlatform || !this.bleManager) {
      return;
    }

    try {
      const device = await this.bleManager.devices([deviceId]);
      if (device.length > 0) {
        await device[0].cancelConnection();
      }
    } catch (error) {
      console.error('Disconnect Error:', error);
    }
  }

  async readCharacteristic(
    device: any,
    serviceUUID: string,
    characteristicUUID: string
  ): Promise<string | null> {
    if (this.isWebPlatform || !device) {
      return null;
    }

    try {
      const services = await device.services();
      for (const service of services) {
        if (service.uuid === serviceUUID) {
          const characteristics = await service.characteristics();
          for (const char of characteristics) {
            if (char.uuid === characteristicUUID) {
              const result = await char.read();
              return result.value;
            }
          }
        }
      }
      return null;
    } catch (error) {
      console.error('Read Error:', error);
      return null;
    }
  }

  async writeCharacteristic(
    device: any,
    serviceUUID: string,
    characteristicUUID: string,
    value: string
  ): Promise<boolean> {
    if (this.isWebPlatform || !device) {
      return false;
    }

    try {
      const services = await device.services();
      for (const service of services) {
        if (service.uuid === serviceUUID) {
          const characteristics = await service.characteristics();
          for (const char of characteristics) {
            if (char.uuid === characteristicUUID) {
              await char.writeWithResponse(value);
              return true;
            }
          }
        }
      }
      return false;
    } catch (error) {
      console.error('Write Error:', error);
      return false;
    }
  }

  async monitorCharacteristic(
    device: any,
    serviceUUID: string,
    characteristicUUID: string,
    onData: (data: string) => void,
    onError?: (error: Error) => void
  ): Promise<void> {
    if (this.isWebPlatform || !device) {
      return;
    }

    try {
      const services = await device.services();
      for (const service of services) {
        if (service.uuid === serviceUUID) {
          const characteristics = await service.characteristics();
          for (const char of characteristics) {
            if (char.uuid === characteristicUUID) {
              char.monitor((error: any, characteristic: any) => {
                if (error) {
                  onError?.(new Error(error.message));
                } else if (characteristic?.value) {
                  onData(characteristic.value);
                }
              });
              return;
            }
          }
        }
      }
    } catch (error) {
      console.error('Monitor Error:', error);
    }
  }

  destroy(): void {
    this.stopScanning();
    if (!this.isWebPlatform && this.bleManager) {
      this.bleManager.destroy();
    }
  }
}

export const bleService = new BLEService();
export default bleService;