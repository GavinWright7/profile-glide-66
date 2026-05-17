import { useEffect, useRef, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { BACKEND_URL, saveSession, buildAuthDeepLink, LOGGED_OUT_FLAG } from '../auth/authService';
import { isValidLinkedInUrl } from '../utils/linkedinUrl';

/**
 * Handles the LinkedIn OAuth callback after the user approves on LinkedIn.
 *
 * Two contexts where this page runs:
 *
 * 1. iOS in-app browser (SFSafariViewController)
 *    - Opened by Browser.open() from the native app
 *    - After exchanging the code this page triggers airlinks://auth?token=JWT
 *    - iOS routes that deep link to the native app, which closes the browser
 *
 * 2. Regular web browser (Vite dev server, http://localhost:5173)
 *    - After exchanging the code, session is saved to localStorage
 *    - Page navigates to / where AuthProvider hydrates from localStorage
 */
const LinkedInCallbackPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const ran = useRef(false);

  useEffect(() => {
    // Strict mode double-invoke guard
    if (ran.current) return;
    ran.current = true;

    const code = searchParams.get('code');
    const errorParam = searchParams.get('error');
    const errorDesc = searchParams.get('error_description');

    if (errorParam) {
      const errMsg = (errorDesc || errorParam || 'unknown_error').toString().trim();
      if (Capacitor.isNativePlatform()) {
        window.location.href = buildAuthDeepLink({ error: errMsg });
        return;
      }
      setError(errMsg);
      return;
    }

    if (!code) {
      if (Capacitor.isNativePlatform()) {
        window.location.href = buildAuthDeepLink({ error: 'No authorization code was returned by LinkedIn.' });
        return;
      }
      setError('No authorization code was returned by LinkedIn.');
      return;
    }

    (async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/auth/linkedin/exchange`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Token exchange failed');
        }

        const { token, user } = data;

        // Persist session so AuthProvider can hydrate it on next mount
        saveSession({ token, user });
        try {
          sessionStorage.removeItem(LOGGED_OUT_FLAG);
        } catch {
          /* ignore */
        }

        // --- Native (iOS in-app browser) ---
        window.location.href = buildAuthDeepLink({ token });

        // --- Web browser fallback ---
        // Deep link will fail silently in a regular browser.
        // After a short pause, navigate — AuthProvider reads localStorage.
        // If user has no linkedin_url, go to onboarding first.
        const target = user?.linkedinUrl && isValidLinkedInUrl(user.linkedinUrl)
          ? '/'
          : '/onboarding/linkedin-url';
        setTimeout(() => {
          navigate(target, { replace: true });
        }, 400);
      } catch (err) {
        const msg = (err instanceof Error ? err.message : 'Authentication failed').toString().trim();
        if (Capacitor.isNativePlatform()) {
          window.location.href = buildAuthDeepLink({ error: msg });
          return;
        }
        setError(msg);
      }
    })();
  }, []);

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <p className="text-destructive font-semibold mb-2">Sign in failed</p>
        <p className="text-sm text-muted-foreground mb-6">{error}</p>
        <button
          className="text-primary text-sm underline"
          onClick={() => navigate('/login', { replace: true })}
        >
          Back to login
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      <p className="text-sm text-muted-foreground">Signing you in…</p>
    </div>
  );
};

export default LinkedInCallbackPage;
