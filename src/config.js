// Public-facing facts in one place. Keep public/legal.html in step with these.
export const APP_NAME = 'Hours Log';
export const APP_FULL_NAME = 'Hours Log for the WV Medicaid Work Rule (unofficial)';
export const AUTHOR = 'Mike Sheridan';
export const CONTACT_EMAIL = 'mike@mikesheridandigital.com';
export const SOURCE_URL = 'https://github.com/cessnamike/hours-log'; // The AGPL requires offering the source
export const LEGAL_URL = '/legal.html';
// Anonymous first-open count (no ID, no personal data). Empty = off.
// netlify.toml sets VITE_COUNT_URL for the site build (GoatCounter, cessnamike.goatcounter.com).
// The counter's host must be in connect-src in security-headers.js and netlify.toml.
export const COUNT_URL = import.meta.env?.VITE_COUNT_URL || '';
// Official pages people should check for themselves.
// The state's own site about the rule (WV Department of Human Services).
export const STATE_INFO_URL = 'https://wvmedicaidhelp.org';
export const STATE_INFO_LABEL = 'wvmedicaidhelp.org';
export const STATE_LINKS = [
  ["wvmedicaidhelp.org: the state's guide to the new rules", 'https://wvmedicaidhelp.org'],
  ['Will this apply to you?', 'https://wvmedicaidhelp.org/will-this-apply-to-you/'],
  ['Questions and answers', 'https://wvmedicaidhelp.org/faqs/'],
  ['WV Bureau for Medical Services', 'https://bms.wv.gov/new-medicaid-rules-are-coming'],
  ['WV PATH (your Medicaid account)', 'https://www.wvpath.wv.gov'],
];
export const STATE_PHONE = '1-877-716-1212';
