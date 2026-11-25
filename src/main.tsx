import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { readUrlOverrides } from './state/urlParams';
import { useHoop } from './state/store';
import { useApp } from './state/app';
import { enterStitch } from './state/flow';

const overrides = readUrlOverrides(window.location.search);
if (Object.keys(overrides).length > 0) useHoop.getState().set(overrides);
// ?hoop=1 opens straight into the hoop view (tests, look checks).
if (new URLSearchParams(window.location.search).get('hoop') === '1') {
  if (useHoop.getState().source === 'product') enterStitch();
  else useApp.getState().set({ screen: 'stitch' });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
