import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@sweetwo/app';
import '@sweetwo/ui/styles.css';

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('#root가 없어요');

createRoot(rootEl).render(
  <StrictMode>
    <App platform="web" />
  </StrictMode>,
);
