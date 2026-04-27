import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.epicenter.hifi',
  appName: 'EpicenterDSP Player',
  webDir: 'dist/public',
  server: {
    androidScheme: 'https',
  },
  android: {
    backgroundColor: '#000000',
    allowMixedContent: true,
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: '#000000',
      showSpinner: false,
      launchAutoHide: true,
    },
  },
};

export default config;
