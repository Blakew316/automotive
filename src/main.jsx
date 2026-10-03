import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';
import './index.css';
import App from './App.jsx';
import { initPwa } from './lib/pwa';
import { initViewport } from './lib/viewport';
import { SMALL_ENGINE } from './lib/edition';

// A deep link into the Small Engine Edition reaches its shell as ?go=<path> (scripts/pages.mjs):
// put the path back before the router reads it.
if (SMALL_ENGINE) {
  const go = new URLSearchParams(window.location.search).get('go');
  if (go && !/^[/\\]/.test(go) && !/^[a-z][a-z0-9+.-]*:/i.test(go)) window.history.replaceState(null, '', import.meta.env.BASE_URL + go);
}

initPwa();
initViewport();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
