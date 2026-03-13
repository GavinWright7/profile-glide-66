/**
 * Validate and normalize LinkedIn public profile URLs.
 * Accepts URLs with query params, UTM params, fragments, etc.
 * Extracts the slug and returns a clean normalized URL.
 *
 * Examples accepted:
 *   http://linkedin.com/in/gavinswright620?utm_source=share&utm_campaign=...
 *   https://www.linkedin.com/in/janedoe/
 *   linkedin.com/in/username#section
 *
 * All normalize to: https://www.linkedin.com/in/{slug}/
 */

const SLUG_PATTERN = /linkedin\.com\/in\/([a-zA-Z0-9_-]+)/i;

/**
 * Returns the normalized URL (https://www.linkedin.com/in/{slug}/) or null if invalid.
 * Strips query params, UTM params, fragments, etc.
 */
function validateAndNormalize(url) {
  if (!url || typeof url !== 'string') return null;
  let s = url.trim();
  if (!s) return null;

  if (!/^https?:\/\//i.test(s)) {
    s = 'https://' + s;
  }

  const match = s.match(SLUG_PATTERN);
  if (!match) return null;
  const slug = match[1];
  if (!slug || slug.length < 2) return null;

  return `https://www.linkedin.com/in/${slug}/`;
}

module.exports = { validateAndNormalize };
