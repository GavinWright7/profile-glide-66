import { useState } from 'react';
import { useSharing } from '../hooks/useSharing';

/**
 * Temporary on-screen debug panel for location-based sharing + background state.
 * Tap "⚙ GPS" to expand / collapse.
 * Remove once background sharing is confirmed working on two real iPhones.
 */
const SharingDebugPanel = () => {
  const [open, setOpen] = useState(false);
  const s = useSharing();

  const dot  = (ok: boolean | null) =>
    ok === null ? '⬜' : ok ? '🟢' : '🔴';
  const fmt  = (d: Date | null) =>
    d ? d.toLocaleTimeString('en-US', { hour12: false }) : '—';
  const fmtCoord = (n: number) => n.toFixed(5);

  const locationOk   = s.locationPermission === 'granted';
  const lifecycleDot = s.appLifecycle === 'foreground' ? '🟢' : '🟡';

  return (
    <div className="fixed bottom-20 right-3 z-50 text-left">
      <button
        onClick={() => setOpen((o) => !o)}
        className="bg-black/80 text-white text-[10px] font-mono px-2 py-1 rounded-full border border-white/20 mb-1 block ml-auto"
      >
        {open ? '✕ GPS' : '⚙ GPS'}
      </button>

      {open && (
        <div className="bg-black/90 border border-white/10 rounded-lg p-3 w-72 text-[10px] font-mono text-white/80 space-y-1 max-h-[70vh] overflow-y-auto">
          <p className="text-white/50 text-[9px] uppercase tracking-widest mb-2">
            Sharing Debug
          </p>

          {/* Core status */}
          <Row label="Sharing"        value={`${dot(s.isSharing)} ${s.isSharing ? 'active' : 'off'}`} />
          <Row label="App lifecycle"  value={`${lifecycleDot} ${s.appLifecycle}`} />
          <Row label="Location perm"  value={`${dot(locationOk)} ${s.locationPermission}`} />

          {/* Background */}
          <div className="border-t border-white/10 pt-1 mt-1">
            <p className="text-white/50 text-[9px] mb-1">Background</p>
            <Row label="BG sharing"   value={`${dot(s.backgroundSharingEnabled)} ${s.backgroundSharingEnabled ? 'enabled' : 'disabled'}`} />
            <Row label="Heartbeat"    value={`every ${s.heartbeatIntervalMs / 1000}s`} />
            <Row label="Last HB"      value={fmt(s.lastHeartbeatAt)} />
            <Row label="Last poll"    value={fmt(s.lastPollAt)} />
          </div>

          {/* Location */}
          {s.currentLocation && (
            <div className="border-t border-white/10 pt-1 mt-1">
              <p className="text-white/50 text-[9px] mb-1">Location</p>
              <Row
                label="Coords"
                value={`${fmtCoord(s.currentLocation.lat)},${fmtCoord(s.currentLocation.lng)}`}
              />
            </div>
          )}

          {/* Nearby users */}
          <div className="border-t border-white/10 pt-1 mt-1">
            <p className="text-white/50 text-[9px] mb-1">Nearby (backend returns)</p>
            <Row label="Count" value={String(s.nearbyUsers.length)} />
            {s.nearbyUsers.map((u) => (
              <div key={u.userId} className="mt-1 pl-1 border-l border-white/10">
                <p className="text-white/80 font-semibold">{u.fullName}</p>
                <p className="text-white/50">{u.distanceMeters} m away</p>
              </div>
            ))}
            {s.nearbyUsers.length === 0 && s.isSharing && (
              <p className="text-white/30 text-[9px]">
                Users disappear when: sharing off / heartbeat expired / out of discovery range
              </p>
            )}
          </div>

          {/* Toggle background sharing */}
          <div className="border-t border-white/10 pt-2 mt-1">
            <button
              className={`w-full text-[10px] font-mono py-1 px-2 rounded border ${
                s.backgroundSharingEnabled
                  ? 'border-green-500/40 text-green-400 bg-green-500/10'
                  : 'border-white/20 text-white/50 bg-white/5'
              }`}
              onClick={() => s.setBackgroundSharingEnabled(!s.backgroundSharingEnabled)}
            >
              {s.backgroundSharingEnabled ? '🟢 BG sharing ON' : '🔴 BG sharing OFF'} — tap to toggle
            </button>
          </div>

          {/* Error */}
          {s.error && (
            <div className="border-t border-white/10 pt-1 mt-1">
              <p className="text-red-400 break-all">ERR: {s.error}</p>
            </div>
          )}

          {/* Log */}
          <div className="border-t border-white/10 pt-1 mt-1">
            <p className="text-white/50 text-[9px] mb-1">Log (last 10)</p>
            <div className="space-y-[2px]">
              {s.logs.slice(-10).map((l, i) => (
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
    <span className="text-white/90 text-right break-all">{value}</span>
  </div>
);

export default SharingDebugPanel;
