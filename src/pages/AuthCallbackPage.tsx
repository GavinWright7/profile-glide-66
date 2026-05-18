import { useEffect, useRef, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { saveSession, decodeToken, LOGGED_OUT_FLAG } from '../auth/authService';
import { isValidLinkedInUrl } from '../utils/linkedinUrl';

/**
 * OAuth completion for web: backend redirects here with ?token=JWT or ?error=…
 * (Not used by the native app; mobile uses airlinks:// deep links.)
 */
const AuthCallbackPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const err = searchParams.get('error');
    if (err) {
      setError(err.trim() || 'Sign in failed');
      return;
    }

    const token = searchParams.get('token');
    if (!token?.trim()) {
      setError('Missing token');
      return;
    }

    const user = decodeToken(token.trim());
    if (!user) {
      setError('Invalid session token');
      return;
    }

    void (async () => {
      saveSession({ token: token.trim(), user });
      try {
        sessionStorage.removeItem(LOGGED_OUT_FLAG);
      } catch {
        /* ignore */
      }

      const target =
        user.linkedinUrl && isValidLinkedInUrl(user.linkedinUrl)
          ? '/'
          : '/onboarding/linkedin-url';
      navigate(target, { replace: true });
    })();
  }, [navigate, searchParams]);

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <p className="text-destructive font-semibold mb-2">Sign in failed</p>
        <p className="text-sm text-muted-foreground mb-6 break-words max-w-md">{error}</p>
        <button
          type="button"
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

export default AuthCallbackPage;
