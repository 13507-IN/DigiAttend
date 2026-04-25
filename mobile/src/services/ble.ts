import { BleManager, Device, Characteristic } from 'react-native-ble-plx';
import { Platform, PermissionsAndroid, Alert } from 'react-native';
import {
  BLE_SERVICE_UUID,
  BLE_CHARACTERISTIC_UUID,
  BLE_DEVICE_NAME,
  SCAN_TIMEOUT,
  BLE_MANAGER_OPTIONS,
} from '../config/environment';
import { BLEDevice } from '../types';

class BLEService {
  private bleManager: BleManager;
  private isScanning: boolean = false;
  private scannedDevices: Map<string, BLEDevice> = new Map();

  constructor() {
    this.bleManager = new BleManager(BLE_MANAGER_OPTIONS);
  }

  getManager(): BleManager {
    return this.bleManager;
  }

  async requestPermissions(): Promise<boolean> {
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
    try {
      const state = await this.bleManager.state();
      return state === 'PoweredOn';
    } catch (error) {
      console.error('Error checking Bluetooth state:', error);
      return false;
    }
  }

  async startScanning(
    onDeviceFound: (device: BLEDevice) => void,
    onError?: (error: Error) => void
  ): Promise<void> {
    if (this.isScanning) {
      return;
    }

    const hasPermissions = await this.requestPermissions();
    if (!hasPermissions) {
      Alert.alert(
        'Permission Required',
        'Bluetooth and location permissions are required to scan for devices.'
      );
      onError?.(new Error('Permission denied'));
      return;
    }

    const isEnabled = await this.checkBluetoothEnabled();
    if (!isEnabled) {
      Alert.alert(
        'Bluetooth Required',
        'Please enable Bluetooth to scan for attendance beacons.'
      );
      onError?.(new Error('Bluetooth is not enabled'));
      return;
    }

    this.isScanning = true;
    this.scannedDevices.clear();

    const filterServiceUUIDs = [BLE_SERVICE_UUID];

    this.bleManager.startDeviceScan(
      filterServiceUUIDs,
      { allowDuplicates: false },
      (error, device) => {
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
            isConnectable: device.isConnectable || false,
            serviceUUIDs: device.serviceUUIDs || [],
          };
          this.scannedDevices.set(device.id, bleDevice);
          onDeviceFound(bleDevice);
        }
      }
    );

    setTimeout(() => {
      this.stopScanning();
    }, SCAN_TIMEOUT);
  }

  stopScanning(): void {
    if (this.isScanning) {
      this.bleManager.stopDeviceScan();
      this.isScanning = false;
    }
  }

  async connectToDevice(deviceId: string): Promise<Device | null> {
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
    device: Device,
    serviceUUID: string,
    characteristicUUID: string
  ): Promise<string | null> {
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
    device: Device,
    serviceUUID: string,
    characteristicUUID: string,
    value: string
  ): Promise<boolean> {
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
    device: Device,
    serviceUUID: string,
    characteristicUUID: string,
    onData: (data: string) => void,
    onError?: (error: Error) => void
  ): Promise<void> {
    try {
      const services = await device.services();
      for (const service of services) {
        if (service.uuid === serviceUUID) {
          const characteristics = await service.characteristics();
          for (const char of characteristics) {
            if (char.uuid === characteristicUUID) {
              char.monitor((error, characteristic) => {
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
    this.bleManager.destroy();
  }
}

export const bleService = new BLEService();
export default bleService;