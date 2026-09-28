import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ErrorBoundary, initSentry } from 'q-wash-shared';
import './index.css';
import { App } from './App';

// Production only — never sends from local dev, even if VITE_SENTRY_DSN
// leaks into a dev .env by mistake.
if (import.meta.env.PROD) {
  initSentry({ dsn: import.meta.env.VITE_SENTRY_DSN, environment: 'production' });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
