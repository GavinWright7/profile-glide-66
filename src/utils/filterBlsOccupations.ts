/** Default cap for suggestion dropdown performance. */
export const BLS_OCCUPATION_SUGGESTION_LIMIT = 25;

/**
 * Prefix matches first (list order is A–Z). If fewer than `limit`, append substring matches.
 */
export function filterBlsOccupations(
  query: string,
  occupations: readonly string[],
  limit = BLS_OCCUPATION_SUGGESTION_LIMIT,
): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const starts: string[] = [];
  for (const occ of occupations) {
    if (occ.toLowerCase().startsWith(q)) {
      starts.push(occ);
      if (starts.length >= limit) return starts;
    }
  }

  const picked = new Set(starts.map((s) => s.toLowerCase()));
  const need = limit - starts.length;
  if (need <= 0) return starts;

  const contains: string[] = [];
  for (const occ of occupations) {
    const low = occ.toLowerCase();
    if (picked.has(low)) continue;
    if (low.includes(q)) {
      contains.push(occ);
      picked.add(low);
      if (contains.length >= need) break;
    }
  }

  return [...starts, ...contains];
}
