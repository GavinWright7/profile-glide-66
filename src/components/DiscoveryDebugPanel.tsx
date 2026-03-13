import { useState } from 'react';
import { useDiscovery } from '../hooks/useDiscovery';

/**
 * Temporary on-screen debug panel for MultipeerConnectivity state.
 * Tap the "MPC" pill to expand/collapse.
 * Remove this component once two-iPhone discovery is confirmed working.
 */
const DiscoveryDebugPanel = () => {
  const [open, setOpen] = useState(false);
  const mp = useDiscovery();

  const dot = (ok: boolean) => (ok ? '🟢' : '🔴');

  const fmt = (d: Date | null) =>
    d ? d.toLocaleTimeString('en-US', { hour12: false }) : '—';

  return (
    <div className="fixed bottom-20 right-3 z-50 text-left">
      <button
        onClick={() => setOpen((o) => !o)}
        className="bg-black/80 text-white text-[10px] font-mono px-2 py-1 rounded-full border border-white/20 mb-1 block ml-auto"
      >
        {open ? '✕ MPC' : '⚙ MPC'}
      </button>

      {open && (
        <div className="bg-black/90 border border-white/10 rounded-lg p-3 w-64 text-[10px] font-mono text-white/80 space-y-1">
          <p className="text-white/50 text-[9px] uppercase tracking-widest mb-2">
            MultipeerConnectivity Debug
          </p>

          <Row label="Initialized"  value={`${dot(mp.initialized)} ${mp.initialized ? 'yes' : 'no'}`} />
          <Row label="Advertising"  value={`${dot(mp.isAdvertising)} ${mp.isAdvertising ? 'active' : 'off'}`} />
          <Row label="Browsing"     value={`${dot(mp.isBrowsing)} ${mp.isBrowsing ? 'active' : 'off'}`} />

          <div className="border-t border-white/10 pt-1 mt-1">
            <Row label="Peers found" value={String(mp.discoveredPeers.length)} />
            <Row label="Last seen"   value={fmt(mp.lastPeerAt)} />
          </div>

          {mp.discoveredPeers.length > 0 && (
            <div className="border-t border-white/10 pt-1 mt-1">
              <p className="text-white/50 text-[9px] mb-1">Discovered peers</p>
              {mp.discoveredPeers.map((p) => (
                <div key={p.peerId} className="mb-1">
                  <p className="text-white/80 font-semibold">{p.name || '(no name)'}</p>
                  <p className="text-white/50 break-all">{p.headline || '—'}</p>
                  <p className="text-white/30">{p.peerId.slice(0, 20)}…</p>
                </div>
              ))}
            </div>
          )}

          {mp.error && (
            <div className="border-t border-white/10 pt-1 mt-1">
              <p className="text-red-400 break-all">ERR: {mp.error}</p>
            </div>
          )}

          <div className="border-t border-white/10 pt-1 mt-1">
            <p className="text-white/50 text-[9px] mb-1">Log (last 8)</p>
            <div className="space-y-[2px] max-h-28 overflow-y-auto">
              {mp.logs.slice(-8).map((l, i) => (
                <p key={i} className="text-white/50 leading-tight break-all">
                  {l}
                </p>
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

export default DiscoveryDebugPanel;
