import { APP_FULL_NAME, AUTHOR, CONTACT_EMAIL, SOURCE_URL, LEGAL_URL, STATE_LINKS, STATE_PHONE } from '../config.js';
import { RULES_CHECKED, dateLabel } from '../rules.js';

export function About() {
  return (
    <>
      <h1>About</h1>
      <div class="card">
        <h2>Who the rule affects</h2>
        <p>Starting in 2027, many West Virginia Medicaid members aged 19 to 64 must show 80 hours a month of work,
          volunteering, job training or school, or $580 a month in income. Some people are exempt, like
          pregnant women, parents of young children and people with disabilities.</p>
        <p><b>Check the state's own pages to see if it applies to you:</b></p>
        <ul class="plain links">
          {STATE_LINKS.map(([label, href]) => <li><a href={href} target="_blank" rel="noopener">{label}</a></li>)}
          <li>Call the state: <a href={`tel:${STATE_PHONE}`}>{STATE_PHONE}</a></li>
        </ul>
        <p class="muted small">Rules in this app last checked {dateLabel(RULES_CHECKED)}. They may have changed since.</p>
      </div>
      <div class="card">
        <h2>This app</h2>
        <p><b>Hours Log, created by {AUTHOR}.</b> {APP_FULL_NAME} is free to use. {AUTHOR} is not a lawyer and does
          not work for the state or any Medicaid plan.</p>
        <ul class="plain links">
          <li><a href={LEGAL_URL} target="_blank" rel="noopener">Terms, privacy and license</a></li>
          <li><a href={SOURCE_URL} target="_blank" rel="noopener">Source code (GNU AGPL 3.0)</a></li>
          <li>Contact: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></li>
        </ul>
        <p class="muted small">Version {__APP_VERSION__}</p>
      </div>
    </>
  );
}
