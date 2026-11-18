import { render } from 'preact';
import { registerSW } from 'virtual:pwa-register';
import { App } from './app.jsx';
import './styles.css';

registerSW({ immediate: true });

// Ask the browser not to clear our data when the phone runs low on space.
navigator.storage?.persist?.().catch(() => {});

render(<App />, document.getElementById('app'));
