import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.almamo.hardware',
  appName: 'خردوات المامو',
  webDir: 'dist',
  server: {
    // Use https://first-hook-1w2pc.web.app (authorized in Firebase Auth for this project)
    // while keeping authDomain on first-hook-1w2pc.firebaseapp.com so:
    // 1) Local APK assets load offline from dist/ under a real Firebase-authorized HTTPS origin (no auth/unauthorized-domain)
    // 2) Web Camera API (getUserMedia), IndexedDB, and Persistent Storage run in a full Secure Context
    androidScheme: 'https',
    hostname: 'first-hook-1w2pc.web.app',
    allowNavigation: [
      'first-hook-1w2pc.firebaseapp.com',
      '*.firebaseapp.com',
      '*.googleapis.com',
      '*.google.com',
      'accounts.google.com',
      '*.googleusercontent.com',
      '*.onrender.com',
    ],
  },
  android: {
    allowMixedContent: false,
    captureInput: false,
    backgroundColor: '#020617',
  },
};

export default config;
