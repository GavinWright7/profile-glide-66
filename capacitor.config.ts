import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.siblingrivalry.profileglide',
  appName: 'AirLinks',
  webDir: 'dist',
  /** WebView letterboxing color when content does not fill the screen */
  backgroundColor: '#0f1419',
  ios: {
    /** Edge-to-edge WebView; safe areas handled in CSS via env(safe-area-inset-*) */
    contentInset: 'never',
    scrollEnabled: true,
  },
  // Deep link URL scheme (airlinks://) is registered natively:
  //   iOS  → ios/App/App/Info.plist  (CFBundleURLTypes → CFBundleURLSchemes)
  //   Android → android/app/src/main/AndroidManifest.xml (<intent-filter>)
  // capacitor.config.ts has no typed field for app URL schemes.
};

export default config;
