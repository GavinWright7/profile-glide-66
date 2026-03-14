import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BACKEND_URL } from '@/auth/authService';

export default function SocialModePage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) {
      setErrorMessage('Please enter your email');
      setStatus('error');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) {
      setErrorMessage('Please enter a valid email address');
      setStatus('error');
      return;
    }

    setStatus('loading');
    setErrorMessage('');

    try {
      const res = await fetch(`${BACKEND_URL}/social-mode/early-access`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed }),
      });
      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.error || 'Something went wrong');
        setStatus('error');
        return;
      }

      setStatus('success');
      setEmail('');
    } catch {
      setErrorMessage('Something went wrong. Please try again.');
      setStatus('error');
    }
  };

  return (
    <div className="min-h-screen page-with-header p-6 pb-24 max-w-md mx-auto social-mode-page">
      <div className="flex flex-col max-w-sm w-full mx-auto">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-foreground/80 hover:text-foreground mb-6 -mt-2 transition-colors"
          aria-label="Back to Home"
        >
          <ArrowLeft size={20} strokeWidth={2} />
          <span className="text-sm font-medium">Back</span>
        </button>

        <h1 className="text-2xl font-bold text-foreground mb-2">Social Mode</h1>

        <div className="space-y-4 mb-10">
          <p className="text-foreground/90 leading-relaxed">
            Looking to grow your following in real life?
          </p>
          <p className="text-foreground/90 leading-relaxed">
            Connect with real people while you are out and about.
          </p>
          <p className="text-sm font-medium text-foreground/80">Coming soon.</p>
          <p className="text-foreground/80 text-sm leading-relaxed">
            Social Mode is where you can connect TikTok, Instagram, and many more to be discoverable
            by people in your radius.
          </p>
        </div>

        {status === 'success' ? (
          <div className="rounded-xl bg-success/15 border border-success/30 px-4 py-4 mb-6">
            <p className="text-sm font-medium text-success">You&apos;re on the list!</p>
            <p className="text-xs text-foreground/70 mt-1">
              We&apos;ll notify you when Social Mode launches.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <Input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={status === 'loading'}
              className="bg-background/80"
              autoComplete="email"
            />
            <Button type="submit" className="w-full" disabled={status === 'loading'}>
              {status === 'loading' ? 'Signing up…' : 'Sign Up'}
            </Button>
            {status === 'error' && errorMessage && (
              <p className="text-xs text-destructive">{errorMessage}</p>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
