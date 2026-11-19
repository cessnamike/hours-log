# Hours Log for the WV Medicaid Work Rule (unofficial)

Phone-first, offline PWA for logging Medicaid community engagement (work requirement) hours and monthly net income, and producing a monthly PDF report. All data stays on the device (IndexedDB); there is no server.

**Not affiliated with the State of West Virginia. Not legal advice.** For more information about the rule, check out [wvmedicaidhelp.org](https://wvmedicaidhelp.org), the WV Department of Human Services' guide.

## Rules modeled (42 CFR 435.552, CMS-2454-IFC, 91 FR 33348, June 3 2026)
- 80 hours/month across work (paid, in-kind or unpaid, incl. family caregiving), community service, work program, education.
- Net (MAGI) monthly income >= federal minimum wage x 80 ($580) meets the month.
- Income below that converts to work hours (income / min wage). This is a **substitute** for logged paid/business hours, not an addition (435.552(e)(2)(i)); the app counts the larger of the two.
- Half-time school meets the month; less than half-time: credit hours x 3 x 4.33.
- Seasonal workers: average of the 6 preceding months >= $580 (435.552(g)).
- Noncompliance notice: 30 days beginning the day it is received (435.558(a)(2)); the app shows received + 29 as the reply date.
- Family caregiver exclusion (435.554(c)(3)): relatives who don't live with the person need only regular, non-incidental care, so the report shows days and weeks of care, not just hours. The app never decides eligibility.

## Develop
```
npm install
npm test          # rules + backup round-trip
npm run dev
npm run build && npm run preview   # preview serves the production CSP
```
Stack: Vite, Preact, Dexie, jsPDF + autotable (lazy-loaded), vite-plugin-pwa. Deployed on Netlify (`netlify.toml`).

## Public release
- Hosted at `hours.mikesheridandigital.com` (planned). Terms, privacy and license: `public/legal.html`.
  Bump `TERMS_VERSION` in `src/rules.js` when the terms change materially; the app asks people to accept again.
- Public facts (contact, source URL, state links) live in `src/config.js`.
- Anonymous first-open count: GoatCounter (`cessnamike.goatcounter.com`). Only the Netlify build turns it on (`VITE_COUNT_URL` in `netlify.toml`), so local builds and tests never send a count. The counter host is allowed in the CSP `connect-src` in `netlify.toml` and `security-headers.js`.
- Build targets older phones (Chrome 80, iOS 14).
- Income warning = 138% of the HHS poverty guideline for the household size (2026: $15,960 + $5,680 per added person).

## License
GNU AGPL 3.0 or later, with an attribution term under section 7(b); commercial licenses available. See `LICENSE` and `NOTICE`.
