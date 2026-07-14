/** Major industries — keep in sync with server/constants/interests.js */
export const INDUSTRY_OPTIONS = [
  'Consulting',
  'Education',
  'Energy & Natural Resources',
  'Financial Services',
  'Government & Public Policy',
  'Healthcare & Life Sciences',
  'Human Resources & Recruiting',
  'Law / Legal Services',
  'Manufacturing & Industrial',
  'Marketing & Advertising',
  'Media & Entertainment',
  'Real Estate',
  'Sales & Business Development',
  'Technology',
  'Transportation & Logistics',
] as const;

export type IndustryOption = (typeof INDUSTRY_OPTIONS)[number];
