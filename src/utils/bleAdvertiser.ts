import { registerPlugin, PluginListenerHandle } from '@capacitor/core';

export interface BleAdvertiserPlugin {
  startAdvertising(options: { serviceUUID: string; localName?: string }): Promise<{ success: boolean; advertising: boolean }>;
  stopAdvertising(): Promise<{ success: boolean; advertising: boolean }>;
  isAdvertising(): Promise<{ advertising: boolean }>;
  addListener(event: 'advertisingStateChanged', cb: (data: { advertising: boolean; error?: string }) => void): Promise<PluginListenerHandle>;
  addListener(event: 'peripheralStateChanged', cb: (data: { state: string }) => void): Promise<PluginListenerHandle>;
}

/**
 * Registered against the Swift class BleAdvertiserPlugin.
 * The web implementation returns no-ops so the build works in browser/simulator.
 */
export const BleAdvertiser = registerPlugin<BleAdvertiserPlugin>('BleAdvertiser', {
  web: {
    async startAdvertising() {
      console.log('[BleAdvertiser] web stub — advertising not available in browser');
      return { success: false, advertising: false };
    },
    async stopAdvertising() {
      return { success: true, advertising: false };
    },
    async isAdvertising() {
      return { advertising: false };
    },
    async addListener(_event: string, _cb: unknown) {
      return { remove: async () => {} };
    },
  },
});
