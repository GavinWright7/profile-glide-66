/**
 * Profile bio template from professional background + graduation year.
 */

/** First non-empty trimmed string (treats null/undefined/"" as missing). */
export function coalesceNonEmpty(
  ...values: (string | number | null | undefined)[]
): string | undefined {
  for (const v of values) {
    if (v == null) continue;
    const t = String(v).trim();
    if (t) return t;
  }
  return undefined;
}

export type BioProfileInput = {
  firstName?: string;
  currentJobTitle?: string;
  currentCompany?: string;
  pastJobs?: { title: string; company: string }[];
  almaMater?: string;
  graduationYear?: string | number | null;
};

export function parsePastCompany(raw: string): { title: string; company: string } {
  const t = raw.trim();
  const idx = t.toLowerCase().indexOf(' at ');
  if (idx > 0) {
    return { title: t.slice(0, idx).trim(), company: t.slice(idx + 4).trim() };
  }
  if (t) return { title: '', company: t };
  return { title: '', company: '' };
}

function firstMeaningfulWord(phrase: string): string {
  const words = phrase.trim().split(/\s+/).filter(Boolean);
  let i = 0;
  while (i < words.length && /^(a|an|the)$/i.test(words[i])) i += 1;
  return words[i] || '';
}

export function indefiniteArticle(followingPhrase: string): 'a' | 'an' {
  const word = firstMeaningfulWord(followingPhrase);
  if (!word) return 'a';
  const lower = word.toLowerCase().replace(/^[\d\W]+/, '');
  if (!lower.length) return 'a';

  if (/^(hour|honest|honor|heir)\b/.test(lower)) return 'an';
  if (/^eu\b/.test(lower)) return 'a';
  if (/^one\b/.test(lower)) return 'a';
  if (/^(incoming|undergraduate|undergrad)\b/.test(lower)) return 'an';
  if (/^m\.?b\.?a\.?$/i.test(word)) return 'an';
  if (/^l\.?l\.?m\.?$/i.test(word)) return 'an';

  const first = lower[0];
  if ('aeiou'.includes(first)) {
    if (first === 'u' && /^(uni|user|usual|unicorn|use(?!d\b))\b/.test(lower)) return 'a';
    return 'an';
  }
  return 'a';
}

/** Parse 4-digit graduation year from string or number (e.g. 2026, "2026", "May 2026"). */
export function parseGradYear(y: string | number | null | undefined): number | null {
  if (y == null || y === '') return null;
  if (typeof y === 'number' && Number.isFinite(y)) {
    const n = Math.trunc(y);
    return n >= 1950 && n <= 2100 ? n : null;
  }
  const t = String(y).trim();
  if (/^\d{4}$/.test(t)) {
    const n = parseInt(t, 10);
    return Number.isFinite(n) ? n : null;
  }
  const m = t.match(/\b(19\d{2}|20\d{2}|2100)\b/);
  if (m) {
    const n = parseInt(m[1], 10);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function normalizeGraduationYear(y: string | number | null | undefined): string | undefined {
  const n = parseGradYear(y);
  return n != null ? String(n) : undefined;
}

function educationLine(almaMater: string, graduationYear: string | number | null | undefined): string | null {
  const school = almaMater.trim();
  if (!school) return null;
  const yearNum = parseGradYear(graduationYear);
  const currentYear = new Date().getFullYear();
  if (yearNum !== null && yearNum >= currentYear) {
    return `I am studying at ${school}.`;
  }
  return `I studied at ${school}.`;
}

function isCurrentStudentByGradYear(graduationYear: string | number | null | undefined): boolean {
  const n = parseGradYear(graduationYear);
  if (n === null) return false;
  return n >= new Date().getFullYear();
}

export function generateBio(profile: BioProfileInput): string {
  const studentVoice = isCurrentStudentByGradYear(profile.graduationYear);
  const parts: string[] = [];
  parts.push(`Hi, I'm ${profile.firstName || 'there'}.`);

  if (profile.currentJobTitle && profile.currentCompany) {
    const a = indefiniteArticle(profile.currentJobTitle);
    if (studentVoice) {
      parts.push(`I'm currently ${a} ${profile.currentJobTitle} at ${profile.currentCompany}.`);
    } else {
      parts.push(`I currently work as ${a} ${profile.currentJobTitle} at ${profile.currentCompany}.`);
    }
  } else if (profile.currentJobTitle) {
    const a = indefiniteArticle(profile.currentJobTitle);
    if (studentVoice) {
      parts.push(`I'm currently ${a} ${profile.currentJobTitle}.`);
    } else {
      parts.push(`I currently work as ${a} ${profile.currentJobTitle}.`);
    }
  }

  if (profile.pastJobs && profile.pastJobs.length > 0) {
    const { title, company } = profile.pastJobs[0];
    if (title && company) {
      const a = indefiniteArticle(title);
      parts.push(`Previously, I was ${a} ${title} at ${company}.`);
    } else if (company) {
      parts.push(`Previously, I worked at ${company}.`);
    } else if (title) {
      const a = indefiniteArticle(title);
      parts.push(`Previously, I was ${a} ${title}.`);
    }
  }

  const edu = educationLine(profile.almaMater ?? '', profile.graduationYear);
  if (edu) parts.push(edu);

  parts.push(`Let's connect!`);
  return parts.join(' ');
}

/** True when stored bio looks like our auto template (safe to replace when background changes). */
export function isLikelyAutoGeneratedBio(stored: string | null | undefined): boolean {
  const t = (stored ?? '').trim();
  if (!t) return true;
  if (!/^Hi, I'?m /i.test(t)) return false;
  if (/Let's connect!/i.test(t)) return true;
  return /(studied at|studying at|graduated in|will graduate in|currently work as|I'm currently)/i.test(t);
}

export function resolveDisplayBio(
  storedBio: string | null | undefined,
  profile: BioProfileInput
): string {
  const stored = (storedBio ?? '').trim();
  if (stored) return stored;
  return generateBio(profile);
}

export function bioProfileFromUser(user: {
  firstName?: string;
  currentJobTitle?: string | null;
  currentCompany?: string | null;
  pastCompanies?: string[];
  almaMater?: string | null;
  graduationYear?: string | number | null;
} | null | undefined): BioProfileInput {
  const pastCompanies = user?.pastCompanies ?? [];
  const first = pastCompanies[0] ? parsePastCompany(pastCompanies[0]) : { title: '', company: '' };
  const pastJobs =
    first.title || first.company ? [{ title: first.title, company: first.company }] : undefined;
  return {
    firstName: coalesceNonEmpty(user?.firstName),
    currentJobTitle: coalesceNonEmpty(user?.currentJobTitle),
    currentCompany: coalesceNonEmpty(user?.currentCompany),
    pastJobs,
    almaMater: coalesceNonEmpty(user?.almaMater),
    graduationYear: normalizeGraduationYear(coalesceNonEmpty(user?.graduationYear)),
  };
}

/** Merge API user with session user so school/year survive partial DB rows. */
export function bioProfileFromAuthUsers(
  primary: {
    firstName?: string;
    currentJobTitle?: string | null;
    currentCompany?: string | null;
    pastCompanies?: string[];
    almaMater?: string | null;
    graduationYear?: string | number | null;
  } | null | undefined,
  fallback?: {
    firstName?: string;
    currentJobTitle?: string | null;
    currentCompany?: string | null;
    pastCompanies?: string[];
    almaMater?: string | null;
    graduationYear?: string | number | null;
  } | null | undefined
): BioProfileInput {
  const pastCompanies =
    (primary?.pastCompanies?.length ? primary.pastCompanies : fallback?.pastCompanies) ?? [];
  const first = pastCompanies[0] ? parsePastCompany(pastCompanies[0]) : { title: '', company: '' };
  const pastJobs =
    first.title || first.company ? [{ title: first.title, company: first.company }] : undefined;
  return {
    firstName: coalesceNonEmpty(primary?.firstName, fallback?.firstName),
    currentJobTitle: coalesceNonEmpty(primary?.currentJobTitle, fallback?.currentJobTitle),
    currentCompany: coalesceNonEmpty(primary?.currentCompany, fallback?.currentCompany),
    pastJobs,
    almaMater: coalesceNonEmpty(primary?.almaMater, fallback?.almaMater),
    graduationYear: normalizeGraduationYear(
      coalesceNonEmpty(primary?.graduationYear, fallback?.graduationYear)
    ),
  };
}
