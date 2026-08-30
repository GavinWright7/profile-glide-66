import type { NearbyUser } from '@/data/mockUsers';

export type DiscoverFilters = {
  name: string;
  company: string;
  industry: string;
  graduationYear: string;
  schoolId: string;
  schoolName: string;
};

export const EMPTY_DISCOVER_FILTERS: DiscoverFilters = {
  name: '',
  company: '',
  industry: '',
  graduationYear: '',
  schoolId: '',
  schoolName: '',
};

export function normalizeDiscoverFilters(raw: Partial<DiscoverFilters> | null | undefined): DiscoverFilters {
  return {
    name: String(raw?.name ?? '').trim(),
    company: String(raw?.company ?? '').trim(),
    industry: String(raw?.industry ?? '').trim(),
    graduationYear: String(raw?.graduationYear ?? '').trim(),
    schoolId: String(raw?.schoolId ?? '').trim(),
    schoolName: String(raw?.schoolName ?? '').trim(),
  };
}

export function hasActiveDiscoverFilters(filters: DiscoverFilters): boolean {
  return Boolean(
    filters.name ||
      filters.company ||
      filters.industry ||
      filters.graduationYear ||
      filters.schoolId
  );
}

export function toNearbyQueryParams(filters: DiscoverFilters): Record<string, string> {
  const params: Record<string, string> = {};
  if (filters.name) params.filterName = filters.name;
  if (filters.company) params.filterCompany = filters.company;
  if (filters.industry) params.filterIndustry = filters.industry;
  if (filters.graduationYear) params.filterGraduationYear = filters.graduationYear;
  if (filters.schoolId) params.filterSchoolId = filters.schoolId;
  return params;
}

function includesInsensitive(haystack: string | null | undefined, needle: string): boolean {
  if (!needle) return true;
  return String(haystack ?? '').toLowerCase().includes(needle.toLowerCase());
}

export function userMatchesDiscoverFilters(user: NearbyUser, filters: DiscoverFilters): boolean {
  if (filters.name) {
    const full = user.name || '';
    const parts = full.split(/\s+/);
    const first = parts[0] || '';
    const last = parts.slice(1).join(' ');
    const nameHit =
      includesInsensitive(full, filters.name) ||
      includesInsensitive(first, filters.name) ||
      includesInsensitive(last, filters.name);
    if (!nameHit) return false;
  }

  if (filters.company) {
    const companies = [
      user.currentCompany,
      user.company,
      ...(user.pastCompanies ?? []),
    ];
    if (!companies.some((c) => includesInsensitive(c, filters.company))) return false;
  }

  if (filters.industry) {
    const industries = user.interests?.length ? user.interests : [user.industry];
    if (!industries.some((i) => String(i ?? '').trim() === filters.industry)) return false;
  }

  if (filters.graduationYear) {
    if (String(user.graduationYear ?? '').trim() !== filters.graduationYear) return false;
  }

  if (filters.schoolId) {
    if (String(user.schoolId ?? '').trim() !== filters.schoolId) return false;
  }

  return true;
}
