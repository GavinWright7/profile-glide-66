import { MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';

type AlwaysLocationPromptProps = {
  loading?: boolean;
  onEnable: () => void;
  onLater: () => void;
};

export function AlwaysLocationPrompt({
  loading = false,
  onEnable,
  onLater,
}: AlwaysLocationPromptProps) {
  return (
    <div className="glass-card glow-blue p-6 sm:p-7">
      <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-4">
        <MapPin size={32} className="text-primary" />
      </div>
      <h1 id="always-location-title" className="text-xl font-bold text-foreground mb-3 text-center">
        Keep AirLinks working in the background
      </h1>
      <p className="text-sm text-muted-foreground leading-relaxed text-center">
        AirLinks works best when location access is set to Always. This allows AirLinks to keep your
        nearby professional presence up to date even when the app isn’t actively open, so you can
        stay discoverable and connect with people around you more reliably.
      </p>
      <p className="text-sm text-muted-foreground leading-relaxed text-center mt-3">
        Your location is used only to power nearby discovery and is not used for advertising
        tracking.
      </p>
      <div className="space-y-3 mt-7">
        <Button type="button" className="w-full h-12" disabled={loading} onClick={onEnable}>
          {loading ? 'Requesting permission…' : 'Enable Always Location'}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="w-full text-muted-foreground"
          disabled={loading}
          onClick={onLater}
        >
          Maybe Later
        </Button>
      </div>
    </div>
  );
}
