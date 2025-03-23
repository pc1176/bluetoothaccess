import { Component, OnInit, OnDestroy, PLATFORM_ID, Inject } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';

declare interface Navigator {
  bluetooth: {
    requestDevice(options: {
      acceptAllDevices?: boolean;
      filters?: Array<{ services: string[] }>;
      optionalServices?: string[];
    }): Promise<BluetoothDevice>;
  };
}

declare interface BluetoothDevice {
  id: string;
  name?: string;
  gatt?: BluetoothRemoteGATTServer;
}

declare interface BluetoothRemoteGATTServer {
  connect(): Promise<BluetoothRemoteGATTServer>;
  disconnect(): void;
  connected: boolean;
  getPrimaryService(service: string): Promise<BluetoothRemoteGATTService>;
}

declare interface BluetoothRemoteGATTService {
  getCharacteristic(characteristic: string): Promise<BluetoothRemoteGATTCharacteristic>;
  getCharacteristics(): Promise<BluetoothRemoteGATTCharacteristic[]>;
}

declare interface BluetoothRemoteGATTCharacteristic {
  uuid: string;
  readValue(): Promise<DataView>;
}

interface CustomBluetoothDevice {
  id: string;
  name: string;
  device: BluetoothDevice;
  connected: boolean;
  connecting: boolean;
}

@Component({
  selector: 'app-bluetoothaccess',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './bluetoothaccess.component.html',
  styleUrls: ['./bluetoothaccess.component.css']
})
export class BluetoothAccessComponent implements OnInit, OnDestroy {
  bluetoothDevices: CustomBluetoothDevice[] = [];
  isScanning = false;
  isBrowserEnv: boolean;

  private readonly BLUETOOTH_SERVICES = [
    'generic_access',
    'generic_attribute',
    'device_information',
    'battery_service',
    '0000180a-0000-1000-8000-00805f9b34fb'
  ];

  constructor(@Inject(PLATFORM_ID) private platformId: object) {
    this.isBrowserEnv = isPlatformBrowser(this.platformId);
  }

  ngOnInit(): void {
    if (this.isBrowserEnv) {
      this.checkBluetoothAvailability();
    }
  }

  ngOnDestroy(): void {
    if (this.isBrowserEnv) {
      this.disconnectAllDevices();
    }
  }

  private checkBluetoothAvailability(): void {
    if (this.isBrowserEnv && !('bluetooth' in navigator)) {
      console.warn('Bluetooth is not supported in this browser');
    }
  }

  async scanForDevices(): Promise<void> {
    if (!this.isBrowserEnv) {
      console.warn('Bluetooth is only available in browser environment');
      return;
    }

    if (!('bluetooth' in navigator)) {
      alert('Bluetooth is not supported in this browser');
      return;
    }

    this.isScanning = true;
    try {
      const device = await (navigator as Navigator).bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: this.BLUETOOTH_SERVICES
      });

      if (!device) {
        throw new Error('No device selected');
      }

      let deviceName = device.name || 'Unknown Device';
      
      if (device.gatt) {
        try {
          const server = await device.gatt.connect();
          
          try {
            const deviceInfo = await server.getPrimaryService('device_information');
            const characteristics = await deviceInfo.getCharacteristics();
            
            const modelChar = characteristics.find(
              (c: BluetoothRemoteGATTCharacteristic) => c.uuid.includes('2a24')
            );
            if (modelChar) {
              const value = await modelChar.readValue();
              const modelName = new TextDecoder().decode(value);
              if (modelName) {
                deviceName = modelName;
              }
            }
            
            if (deviceName === 'Unknown Device') {
              const manufChar = characteristics.find(
                (c: BluetoothRemoteGATTCharacteristic) => c.uuid.includes('2a29')
              );
              if (manufChar) {
                const value = await manufChar.readValue();
                const manufName = new TextDecoder().decode(value);
                if (manufName) {
                  deviceName = manufName;
                }
              }
            }
          } catch (deviceInfoError) {
            console.warn('Could not read device information:', deviceInfoError);
          }

          if (deviceName === 'Unknown Device') {
            try {
              const genericAccess = await server.getPrimaryService('generic_access');
              const nameChar = await genericAccess.getCharacteristic('device_name');
              const value = await nameChar.readValue();
              const name = new TextDecoder().decode(value);
              if (name) {
                deviceName = name;
              }
            } catch (nameError) {
              console.warn('Could not read device name from generic_access:', nameError);
            }
          }

          server.disconnect();
        } catch (error) {
          console.warn('Could not get detailed device information:', error);
        }
      }

      const newDevice: CustomBluetoothDevice = {
        id: device.id,
        name: deviceName,
        device: device,
        connected: false,
        connecting: false
      };

      const existingDeviceIndex = this.bluetoothDevices.findIndex(d => d.id === newDevice.id);
      if (existingDeviceIndex >= 0) {
        this.bluetoothDevices[existingDeviceIndex] = newDevice;
      } else {
        this.bluetoothDevices = [...this.bluetoothDevices, newDevice];
      }
    } catch (error: any) {
      console.error('Error scanning for Bluetooth devices:', error);
      if (!(error instanceof DOMException && error.name === 'NotFoundError')) {
        alert('Error scanning for Bluetooth devices: ' + error.message);
      }
    } finally {
      this.isScanning = false;
    }
  }

  async connectToDevice(device: CustomBluetoothDevice): Promise<void> {
    if (device.connected) {
      await this.disconnectDevice(device);
      return;
    }

    device.connecting = true;
    try {
      if (!device.device.gatt) {
        throw new Error('GATT server not available');
      }

      const server = await device.device.gatt.connect();
      if (!server) {
        throw new Error('Failed to connect to device');
      }

      device.connected = true;
      console.log('Successfully connected to device:', device.name);
    } catch (error: any) {
      console.error('Error connecting to device:', error);
      alert('Connection failed: ' + (error.message || 'Unknown error'));
      device.connected = false;
    } finally {
      device.connecting = false;
      this.bluetoothDevices = [...this.bluetoothDevices];
    }
  }

  async disconnectDevice(device: CustomBluetoothDevice): Promise<void> {
    if (!device.connected) return;

    try {
      if (device.device.gatt?.connected) {
        device.device.gatt.disconnect();
      }
      device.connected = false;
      console.log('Disconnected from device:', device.name);
    } catch (error) {
      console.error('Error disconnecting from device:', error);
    } finally {
      this.bluetoothDevices = [...this.bluetoothDevices];
    }
  }

  private async disconnectAllDevices(): Promise<void> {
    for (const device of this.bluetoothDevices) {
      if (device.connected) {
        await this.disconnectDevice(device);
      }
    }
  }
}
