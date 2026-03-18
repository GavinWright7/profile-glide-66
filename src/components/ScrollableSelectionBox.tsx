import { type ReactNode } from 'react';

/**
 * Reusable scrollable selection container for onboarding option screens.
 *
 * Layout rules:
 * - maxHeight: 50% of viewport (never grows beyond)
 * - width: responsive, contained (90% of viewport)
 * - Only the inner content scrolls; container does not grow
 * - Submit button sits outside, always visible
 */
export default function ScrollableSelectionBox({ children }: { children: ReactNode }) {
  return (
    <div
      className="w-[90%] max-w-sm mx-auto overflow-y-auto rounded-xl border border-border bg-muted/20 shrink-0"
      style={{
        maxHeight: 'var(--selection-box-max-height)',
        padding: 'var(--options-box-padding)',
      }}
    >
      {children}
    </div>
  );
}
