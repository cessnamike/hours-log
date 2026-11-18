import { saveSettings } from '../db.js';
import { TERMS_VERSION } from '../rules.js';
import { APP_FULL_NAME, LEGAL_URL, STATE_INFO_URL, STATE_INFO_LABEL } from '../config.js';
import { countFirstOpen } from '../count.js';

// Shown on first open, and again whenever TERMS_VERSION changes.
export function Welcome({ data, refresh }) {
  const returning = !!data.settings.acceptedTermsVersion;
  const accept = async () => {
    await saveSettings({ acceptedTermsVersion: TERMS_VERSION });
    if (!returning) countFirstOpen();
    await refresh();
  };
  return (
    <main class="welcome">
      <img src="/icon.svg" alt="" width="72" height="72" />
      <h1>{returning ? 'Our terms changed' : 'Welcome'}</h1>
      <p><b>{APP_FULL_NAME}</b> is a free tool for keeping a record of your hours and income.</p>
      <ul class="plain">
        <li>It is <b>not</b> from the State of West Virginia or any Medicaid plan.</li>
        <li>It is <b>not</b> legal advice. The author is not a lawyer, and the rules can change.</li>
        <li><b>Only the state decides</b> if you meet the rule. Keep your own proof, like pay stubs and signed volunteer sheets.</li>
        <li>Your records stay <b>on this device</b>. Nobody else can see them, so save backups.</li>
      </ul>
      <p>For more information, check out <a href={STATE_INFO_URL} target="_blank" rel="noopener">{STATE_INFO_LABEL}</a>, the state's own guide to the rule.</p>
      <p><a href={LEGAL_URL} target="_blank" rel="noopener">Read the full terms and privacy notice</a></p>
      <button class="primary block big" onClick={accept}>I understand</button>
    </main>
  );
}
