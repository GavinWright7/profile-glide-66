import { useState } from 'react';
import { useBle } from '../hooks/useBle';

/**
 * Temporary on-screen debug panel — shows live BLE state on the device.
 * Tap the "BLE" pill to expand/collapse.
 * Remove this component when BLE is confirmed working.
 */
const BleDebugPanel = () => {
  const [open, setOpen] = useState(false);
  const ble = useBle();

  const dot = (ok: boolean | null) => {
    if (ok === null) return '⬜';
    return ok ? '🟢' : '🔴';
  };

  const fmt = (d: Date | null) =>
    d ? d.toLocaleTimeString('en-US', { hour12: false }) : '—';

  return (
    <div className="fixed bottom-20 right-3 z-50 text-left">
      {/* Toggle pill */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="bg-black/80 text-white text-[10px] font-mono px-2 py-1 rounded-full border border-white/20 mb-1 block ml-auto"
      >
        {open ? '✕ BLE' : '⚙ BLE'}
      </button>

      {open && (
        <div className="bg-black/90 border border-white/10 rounded-lg p-3 w-64 text-[10px] font-mono text-white/80 space-y-1">
          <p className="text-white/50 text-[9px] uppercase tracking-widest mb-2">BLE Debug</p>

          <Row label="Permission" value={`${dot(ble.permissionGranted)} ${ble.permissionGranted === null ? 'unchecked' : ble.permissionGranted ? 'granted' : 'denied'}`} />
          <Row label="BT Power"   value={`${dot(ble.poweredOn)} ${ble.poweredOn === null ? 'unknown' : ble.poweredOn ? 'on' : 'off'}`} />
          <Row label="Initialized" value={dot(ble.initialized) + ' ' + (ble.initialized ? 'yes' : 'no')} />
          <Row label="Advertising" value={`${dot(ble.isAdvertising)} ${ble.isAdvertising ? 'active' : 'off'}`} />
          <Row label="Scanning"   value={`${dot(ble.isScanning)} ${ble.isScanning ? 'active' : 'off'}`} />

          <div className="border-t border-white/10 pt-1 mt-1">
            <Row label="Devices found" value={String(ble.discoveredDevices.length)} />
            <Row label="Last seen"     value={fmt(ble.lastDiscoveryAt)} />
          </div>

          {ble.discoveredDevices.length > 0 && (
            <div className="border-t border-white/10 pt-1 mt-1">
              <p className="text-white/50 text-[9px] mb-1">Nearby devices</p>
              {ble.discoveredDevices.map((d) => (
                <div key={d.deviceId} className="mb-1">
                  <p className="text-white/70">{d.name ?? '(unnamed)'}</p>
                  <p className="text-white/40">{d.deviceId.slice(0, 16)}… rssi={d.rssi}</p>
                </div>
              ))}
            </div>
          )}

          {/* Last 8 log lines */}
          <div className="border-t border-white/10 pt-1 mt-1">
            <p className="text-white/50 text-[9px] mb-1">Log</p>
            <div className="space-y-[2px] max-h-28 overflow-y-auto">
              {ble.logs.slice(-8).map((l, i) => (
                <p key={i} className="text-white/50 leading-tight break-all">{l}</p>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const Row = ({ label, value }: { label: string; value: string }) => (
  <div className="flex justify-between gap-2">
    <span className="text-white/50 shrink-0">{label}</span>
    <span className="text-white/90 text-right">{value}</span>
  </div>
);

export default BleDebugPanel;
