/**
 * ============================================================
 * Print To Frame ERP — Application Entry Point
 * ============================================================
 * Recovered from the compiled dist bundle structure.
 * 
 * NOTE: The full component tree (App.jsx and all tab modules)
 * needs to be reconstructed from the original source or the
 * compiled bundle. This file provides the standard React 18
 * entry point that mounts the app into #root.
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import * as Sentry from "@sentry/react";
import App from './App.jsx';
import ReferralForm from './components/public/ReferralForm.jsx';
import PartnerRegistration from './components/public/PartnerRegistration.jsx';
import './index.css';
import { PermissionsProvider } from './context/PermissionsContext';

const sentryDsn = import.meta.env.VITE_SENTRY_DSN;

if (sentryDsn && typeof sentryDsn === 'string' && sentryDsn.trim() !== '' && sentryDsn !== 'your_sentry_dsn_here' && /^https?:\/\//i.test(sentryDsn)) {
  try {
    Sentry.init({
      dsn: sentryDsn,
      integrations: [
        Sentry.browserTracingIntegration(),
        Sentry.replayIntegration(),
      ],
      // Tracing
      tracesSampleRate: 1.0, // Capture 100% of the transactions
      // Set 'tracePropagationTargets' to control for which URLs distributed tracing should be enabled
      tracePropagationTargets: ["localhost", /^https:\/\/yourserver\.io\/api/],
      // Session Replay
      replaysSessionSampleRate: 0.1,
      replaysOnErrorSampleRate: 1.0,
    });
  } catch (err) {
    console.warn('Failed to initialize Sentry:', err);
  }
}

import { ErrorBoundary } from './components/common/ErrorBoundary';
import LoadingSpinner from './components/common/LoadingSpinner';

const path = window.location.pathname;

if (path.startsWith('/referral')) {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <ErrorBoundary>
        <ReferralForm />
      </ErrorBoundary>
    </React.StrictMode>,
  );
} else if (path.startsWith('/partner/register') || path.startsWith('/register-partner')) {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <ErrorBoundary>
        <PartnerRegistration />
      </ErrorBoundary>
    </React.StrictMode>,
  );
} else {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <ErrorBoundary>
        <React.Suspense fallback={<LoadingSpinner fullScreen message="Loading Print To Frame ERP..." />}>
          <PermissionsProvider>
            <App />
          </PermissionsProvider>
        </React.Suspense>
      </ErrorBoundary>
    </React.StrictMode>,
  );
}
