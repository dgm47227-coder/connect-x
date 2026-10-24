import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.connectx.app',
  appName: 'ConnectX',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
