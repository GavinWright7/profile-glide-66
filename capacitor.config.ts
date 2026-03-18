import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.siblingrivalry.profileglide',
  appName: 'AirLinks',
  webDir: 'dist',
  // Deep link URL scheme (airlinks://) is registered natively:
  //   iOS  → ios/App/App/Info.plist  (CFBundleURLTypes → CFBundleURLSchemes)
  //   Android → android/app/src/main/AndroidManifest.xml (<intent-filter>)
  // capacitor.config.ts has no typed field for app URL schemes.
};

export default config;
