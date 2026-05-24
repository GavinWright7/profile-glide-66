/**
 * iOS/Android system chrome (status bar) aligned with the app dark theme.
 */
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';

/** Matches index.html theme-color and --background. */
export const APP_BACKGROUND_HEX = '#0f1419';

export async function configureNativeChrome(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  try {
    await StatusBar.setOverlaysWebView({ overlay: true });
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: APP_BACKGROUND_HEX });
  } catch {
    /* Status bar APIs are native-only; ignore on unsupported platforms */
  }
}
