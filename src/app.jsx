import { useEffect, useState, useCallback, useRef } from 'preact/hooks';
import { loadAll } from './db.js';
import { Home } from './screens/Home.jsx';
import { EntryForm } from './screens/EntryForm.jsx';
import { TimerScreen } from './screens/Timer.jsx';
import { MonthScreen } from './screens/Month.jsx';
import { History } from './screens/History.jsx';
import { Reports } from './screens/Reports.jsx';
import { Settings } from './screens/Settings.jsx';
import { Welcome } from './screens/Welcome.jsx';
import { About } from './screens/About.jsx';
import { RestoreScreen } from './screens/Backup.jsx';
import { Deleted } from './screens/Deleted.jsx';
import { TERMS_VERSION } from './rules.js';
import { Tabs, Toast } from './ui.jsx';

const parseRoute = () => {
  const [path, query = ''] = (location.hash.slice(1) || '/').split('?');
  return { parts: path.split('/').filter(Boolean), params: new URLSearchParams(query) };
};

export function App() {
  const [data, setData] = useState(null);
  const [route, setRoute] = useState(parseRoute);
  const [toast, setToast] = useState(null);
  const [deleted, setDeleted] = useState(false);
  // After "Delete everything", never touch storage again: a query would recreate the database.
  const gone = useRef(false);

  const refresh = useCallback(async () => { if (!gone.current) setData(await loadAll()); }, []);
  const onDeleted = useCallback(() => { gone.current = true; setDeleted(true); }, []);

  useEffect(() => {
    refresh();
    const onHash = () => {
      setRoute(parseRoute());
      window.scrollTo(0, 0);
    };
    const onVisible = () => document.visibilityState === 'visible' && refresh();
    window.addEventListener('hashchange', onHash);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('hashchange', onHash);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refresh]);

  const notify = useCallback((message, action) => {
    setToast({ message, action, key: Date.now() });
  }, []);

  if (deleted) return <Deleted />;
  if (!data) return <main><p class="muted">Loading…</p></main>;
  if (data.settings.acceptedTermsVersion !== TERMS_VERSION) return <Welcome data={data} refresh={refresh} />;

  const ctx = { data, refresh, notify, route, onDeleted };
  const [screen, arg] = route.parts;
  let view;
  switch (screen) {
    case 'add': view = <EntryForm {...ctx} id={arg} />; break;
    case 'timer': view = <TimerScreen {...ctx} stopping={arg === 'stop'} />; break;
    case 'month': view = <MonthScreen {...ctx} month={arg} />; break;
    case 'history': view = <History {...ctx} />; break;
    case 'reports': view = <Reports {...ctx} />; break;
    case 'settings': view = <Settings {...ctx} />; break;
    case 'about': view = <About />; break;
    case 'restore': view = <RestoreScreen {...ctx} />; break;
    default: view = <Home {...ctx} />;
  }

  return (
    <>
      <main key={route.parts.join('/')}>{view}</main>
      <Tabs current={screen || 'home'} />
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
    </>
  );
}
