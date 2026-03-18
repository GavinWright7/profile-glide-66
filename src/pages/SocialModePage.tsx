import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BACKEND_URL } from '@/auth/authService';

export default function SocialModePage() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setErrorMessage('Please enter your email');
      setStatus('error');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
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
        body: JSON.stringify({ email: trimmedEmail, name: name.trim() || undefined }),
      });
      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.error || 'Something went wrong');
        setStatus('error');
        return;
      }

      setStatus('success');
      setName('');
      setEmail('');
    } catch {
      setErrorMessage('Something went wrong. Please try again.');
      setStatus('error');
    }
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col page-with-header overflow-hidden social-mode-page">
      <div className="flex-1 min-h-0 flex flex-col min-w-0 overflow-y-auto px-[var(--page-padding-x)] pb-20 max-w-md mx-auto w-full">
        <div className="flex flex-col max-w-sm w-full mx-auto gap-[var(--section-gap)]">
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
            Social Mode allows you to connect your TikTok, Instagram, and other social platforms to AirLink, letting you expand your audience by broadcasting your accounts to people in your radius.
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
              type="text"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={status === 'loading'}
              className="bg-background/80"
              autoComplete="name"
            />
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
    </div>
  );
}
