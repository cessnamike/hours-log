import { useInstall } from '../install.js';

// Big "put it on your home screen" card at the top of Home. Hidden inside the installed app.
export function InstallCard({ hasEntries }) {
  const { mode, install, platform } = useInstall();
  if (mode === 'app' || mode === 'wait') return null;

  if (mode === 'done' || mode === 'installed') {
    return (
      <div class="banner good install-done">
        {mode === 'done' ? 'Installed!' : 'Hours Log is on this phone.'}
        <span class="sub">Next time, open it from the Hours Log icon on your home screen or in your list of apps.</span>
      </div>
    );
  }

  return (
    <section class="card install" aria-labelledby="install-h">
      <h2 id="install-h">Put Hours Log on your home screen</h2>
      <p>Then you can open it with one tap, like any other app. It works without internet.</p>
      {mode === 'prompt' && (
        <button class="primary block big" onClick={install}>Install Hours Log</button>
      )}
      {mode === 'ios' && (
        <ol class="steps">
          <li>Tap the <b>Share</b> button <span class="ico" aria-hidden="true">⬆︎</span> (a square with an arrow). In Safari it is at the bottom of the screen.</li>
          <li>Scroll down and tap <b>Add to Home Screen</b>.</li>
          <li>Tap <b>Add</b>.</li>
        </ol>
      )}
      {mode === 'ios' && (
        <p class="help">
          <b>Do this before you add records.</b> On iPhone, records you enter here in Safari stay in Safari and do not show up in the home-screen app.
          {hasEntries && <> You already have records here: first <a href="#/reports">save a backup</a>, then put it back in the home-screen app.</>}
        </p>
      )}
      {mode === 'manual' && platform === 'android' && (
        <ol class="steps">
          <li>Tap the <b>⋮</b> menu at the top right of Chrome.</li>
          <li>Tap <b>Install app</b> or <b>Add to Home screen</b>.</li>
          <li>Tap <b>Install</b> or <b>Add</b>.</li>
        </ol>
      )}
      {mode === 'manual' && platform !== 'android' && (
        <p class="help">
          Look for the install button at the right end of the address bar, or open the browser menu and choose <b>Install</b>.
          If your browser has no install option, add a bookmark for this page instead.
        </p>
      )}
    </section>
  );
}
