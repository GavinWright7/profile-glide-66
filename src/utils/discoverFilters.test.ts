import { describe, expect, it } from 'vitest';
import type { NearbyUser } from '@/data/mockUsers';
import {
  EMPTY_DISCOVER_FILTERS,
  hasActiveDiscoverFilters,
  normalizeDiscoverFilters,
  toNearbyQueryParams,
  userMatchesDiscoverFilters,
} from './discoverFilters';

function user(overrides: Partial<NearbyUser> = {}): NearbyUser {
  return {
    id: '1',
    name: 'Keisha Wright',
    headline: 'Engineer at Google',
    company: 'Google',
    jobTitle: 'Engineer',
    profilePhotoUrl: '',
    linkedinProfileUrl: '',
    linkedinId: '1',
    distance: 20,
    angle: 0,
    currentCompany: 'Google',
    pastCompanies: ['Meta'],
    graduationYear: '2028',
    schoolId: '42',
    school: 'New York University',
    industry: 'Technology',
    interests: ['Technology'],
    ...overrides,
  };
}

describe('discoverFilters', () => {
  it('trims and detects active filters', () => {
    const filters = normalizeDiscoverFilters({ name: '  Jackson  ', company: ' ' });
    expect(filters.name).toBe('Jackson');
    expect(hasActiveDiscoverFilters(filters)).toBe(true);
    expect(hasActiveDiscoverFilters(EMPTY_DISCOVER_FILTERS)).toBe(false);
  });

  it('sends AND query params for every filled field', () => {
    const params = toNearbyQueryParams(
      normalizeDiscoverFilters({
        name: 'Jackson',
        company: 'Google',
        industry: 'Technology',
        graduationYear: '2028',
        schoolId: '42',
      })
    );
    expect(params).toEqual({
      filterName: 'Jackson',
      filterCompany: 'Google',
      filterIndustry: 'Technology',
      filterGraduationYear: '2028',
      filterSchoolId: '42',
    });
  });

  it('matches name case-insensitively and partially', () => {
    expect(userMatchesDiscoverFilters(user({ name: 'Kareem Wright' }), { ...EMPTY_DISCOVER_FILTERS, name: 'jackson' })).toBe(false);
    expect(userMatchesDiscoverFilters(user({ name: 'Jackson Lee' }), { ...EMPTY_DISCOVER_FILTERS, name: 'jack' })).toBe(true);
    expect(userMatchesDiscoverFilters(user({ name: 'Maya Jackson' }), { ...EMPTY_DISCOVER_FILTERS, name: 'Jackson' })).toBe(true);
  });

  it('matches company on current and past companies', () => {
    expect(userMatchesDiscoverFilters(user(), { ...EMPTY_DISCOVER_FILTERS, company: 'google' })).toBe(true);
    expect(userMatchesDiscoverFilters(user(), { ...EMPTY_DISCOVER_FILTERS, company: 'meta' })).toBe(true);
    expect(userMatchesDiscoverFilters(user(), { ...EMPTY_DISCOVER_FILTERS, company: 'Goldman' })).toBe(false);
  });

  it('requires exact graduation year and schoolId', () => {
    expect(userMatchesDiscoverFilters(user(), { ...EMPTY_DISCOVER_FILTERS, graduationYear: '2028' })).toBe(true);
    expect(userMatchesDiscoverFilters(user(), { ...EMPTY_DISCOVER_FILTERS, graduationYear: '2027' })).toBe(false);
    expect(userMatchesDiscoverFilters(user(), { ...EMPTY_DISCOVER_FILTERS, schoolId: '42' })).toBe(true);
    expect(userMatchesDiscoverFilters(user(), { ...EMPTY_DISCOVER_FILTERS, schoolId: '99' })).toBe(false);
  });

  it('combines filters with AND', () => {
    const both = normalizeDiscoverFilters({ name: 'Wright', schoolId: '42' });
    expect(userMatchesDiscoverFilters(user({ name: 'Keisha Wright' }), both)).toBe(true);
    expect(userMatchesDiscoverFilters(user({ name: 'Keisha Wright', schoolId: '7' }), both)).toBe(false);
    expect(userMatchesDiscoverFilters(user({ name: 'Jackson Lee', schoolId: '42' }), both)).toBe(false);
  });
});
