export type RecentlyViewedProfile = {
  id: string;
  name: string;
  title: string;
  company: string;
  viewedAt: string;
};

const STORAGE_KEY = 'recentlyViewedProfiles';
const MAX_ENTRIES = 50;

export function loadRecentlyViewed(): RecentlyViewedProfile[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RecentlyViewedProfile[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function addRecentlyViewed(entry: {
  id: string;
  name: string;
  title: string;
  company: string;
}): RecentlyViewedProfile[] {
  const next: RecentlyViewedProfile = {
    ...entry,
    viewedAt: new Date().toISOString(),
  };
  const withoutDup = loadRecentlyViewed().filter((p) => p.id !== entry.id);
  const list = [next, ...withoutDup].slice(0, MAX_ENTRIES);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
  return list;
}

export function clearRecentlyViewed(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
