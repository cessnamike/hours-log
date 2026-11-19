// "Install on this phone": works out whether the app is installed and how to install it.
// A web page can never install itself; the browser always needs one tap from the person.
import { useEffect, useState } from 'preact/hooks';

let deferredPrompt = null; // Chrome/Edge/Samsung: the browser's own install dialog, saved for our button
let justInstalled = false;
const listeners = new Set();
const changed = () => listeners.forEach((f) => f());

// Start listening as soon as this module loads (main.jsx imports it before rendering),
// because Chrome fires beforeinstallprompt once, early.
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // we show our own big button instead of Chrome's small bar
    deferredPrompt = e;
    changed();
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    justInstalled = true;
    changed();
  });
}

export function isStandalone() {
  try {
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      window.matchMedia('(display-mode: fullscreen)').matches ||
      window.matchMedia('(display-mode: minimal-ui)').matches ||
      window.navigator.standalone === true // iPhone home-screen app
    );
  } catch {
    return false;
  }
}

export function platform() {
  const ua = navigator.userAgent || '';
  const iPadOS = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  if (/iPhone|iPad|iPod/.test(ua) || iPadOS) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'desktop';
}

// Chrome on Android can say whether this app is already installed (see related_applications in the manifest).
async function installedElsewhere() {
  try {
    if (!navigator.getInstalledRelatedApps) return false;
    const apps = await navigator.getInstalledRelatedApps();
    return apps.length > 0;
  } catch {
    return false;
  }
}

// mode:
//   'app'        running as the installed app: show nothing
//   'done'       installed just now, from this tab
//   'installed'  installed already, but opened in a browser tab
//   'prompt'     one-tap install is available
//   'ios'        iPhone/iPad: show the Share > Add to Home Screen steps
//   'manual'     no one-tap install from this browser: show the menu steps
//   'wait'       still finding out (show nothing yet)
export function useInstall() {
  const [, bump] = useState(0);
  const [elsewhere, setElsewhere] = useState(false);
  const [waited, setWaited] = useState(false);

  useEffect(() => {
    const f = () => bump((n) => n + 1);
    listeners.add(f);
    installedElsewhere().then(setElsewhere);
    // Chrome usually offers its install event within a moment of loading; after that, fall back to steps.
    const t = setTimeout(() => setWaited(true), 2500);
    return () => { listeners.delete(f); clearTimeout(t); };
  }, []);

  let mode;
  if (isStandalone()) mode = 'app';
  else if (justInstalled) mode = 'done';
  else if (deferredPrompt) mode = 'prompt';
  else if (elsewhere) mode = 'installed';
  else if (platform() === 'ios') mode = 'ios';
  else mode = waited ? 'manual' : 'wait';

  const install = async () => {
    const p = deferredPrompt;
    if (!p) return false;
    p.prompt();
    const choice = await p.userChoice.catch(() => null);
    if (choice?.outcome === 'accepted') {
      deferredPrompt = null;
      justInstalled = true;
    }
    changed();
    return choice?.outcome === 'accepted';
  };

  return { mode, install, platform: platform() };
}
