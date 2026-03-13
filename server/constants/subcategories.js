/**
 * Subcategories per industry — user may select multiple under each chosen industry.
 * User can skip subcategory selection.
 */
const SUBCATEGORIES_BY_INDUSTRY = {
  'Financial Services': ['Investment Banking', 'Private Equity', 'Venture Capital', 'Asset Management', 'Fintech', 'Insurance', 'Accounting', 'Other'],
  'Technology': ['Software', 'AI/ML', 'SaaS', 'Hardware', 'Cybersecurity', 'Cloud', 'Gaming', 'Other'],
  'Consulting': ['Management', 'Strategy', 'IT', 'HR', 'Sustainability', 'Other'],
  'Healthcare & Life Sciences': ['Pharma', 'Biotech', 'Medical Devices', 'Healthcare IT', 'Clinical', 'Other'],
  'Marketing & Advertising': ['Brand', 'Digital', 'Performance', 'Creative', 'Agency', 'Other'],
  'Human Resources & Recruiting': ['Talent Acquisition', 'HR Operations', 'L&D', 'Compensation', 'Other'],
  'Sales & Business Development': ['Enterprise', 'SMB', 'Partnerships', 'Inside Sales', 'Other'],
  'Education': ['Higher Ed', 'K-12', 'EdTech', 'Corporate Training', 'Other'],
  'Law / Legal Services': ['Corporate', 'Litigation', 'IP', 'Real Estate Law', 'Other'],
  'Real Estate': ['Commercial', 'Residential', 'PropTech', 'Development', 'Other'],
  'Government & Public Policy': ['Federal', 'State/Local', 'Nonprofit', 'Advocacy', 'Other'],
  'Media & Entertainment': ['Film/TV', 'Music', 'Publishing', 'Social', 'Other'],
  'Manufacturing & Industrial': ['Automotive', 'Aerospace', 'Consumer Goods', 'Industrial', 'Other'],
  'Energy & Natural Resources': ['Oil & Gas', 'Renewables', 'Mining', 'Utilities', 'Other'],
  'Transportation & Logistics': ['Logistics', 'Supply Chain', 'Mobility', 'Freight', 'Other'],
};

function getSubcategoriesForIndustry(industry) {
  return SUBCATEGORIES_BY_INDUSTRY[industry] || [];
}

function isValidSubcategory(industry, subcategory) {
  const subs = SUBCATEGORIES_BY_INDUSTRY[industry];
  return subs && subs.includes(subcategory);
}

module.exports = { SUBCATEGORIES_BY_INDUSTRY, getSubcategoriesForIndustry, isValidSubcategory };
