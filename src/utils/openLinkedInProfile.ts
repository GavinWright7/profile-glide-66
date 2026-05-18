import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import { toast } from 'sonner';
import { isValidLinkedInUrl } from '@/utils/linkedinUrl';

/**
 * Open a LinkedIn profile URL (in-app browser / app deep link / fallback).
 * Returns true if a navigation was attempted with a valid URL.
 */
export async function openLinkedInProfile(url: string): Promise<boolean> {
  if (!url || !isValidLinkedInUrl(url)) {
    toast.error('LinkedIn profile is not available for this user.', { duration: 3000 });
    return false;
  }

  if (Capacitor.isNativePlatform()) {
    const slug = url.match(/linkedin\.com\/in\/([a-zA-Z0-9_-]+)/i)?.[1];
    const appDeepLink = slug ? `linkedin://in/${slug}` : null;
    if (appDeepLink) {
      try {
        const result = await App.openUrl({ url: appDeepLink });
        if (result.completed) return true;
      } catch {
        /* fall through */
      }
    }
  }

  try {
    await Browser.open({ url });
    return true;
  } catch {
    window.open(url, '_blank');
    return true;
  }
}
