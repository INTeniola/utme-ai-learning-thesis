import * as Sentry from "@sentry/react";
import { createRoot } from "react-dom/client";
import { registerSW } from 'virtual:pwa-register';
import App from "./App.tsx";
import "./index.css";

// Register PWA service worker
registerSW({ immediate: true });

// Initialize Sentry (disabled if DSN not set — safe for local dev)
const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN;
if (SENTRY_DSN) {
    Sentry.init({
        dsn: SENTRY_DSN,
        environment: import.meta.env.MODE,
        integrations: [
            Sentry.browserTracingIntegration(),
            Sentry.replayIntegration({
                maskAllText: false,
                blockAllMedia: false,
            }),
        ],
        // Capture 10% of transactions for performance monitoring
        tracesSampleRate: 0.1,
        // Capture 100% of sessions with errors for replays
        replaysOnErrorSampleRate: 1.0,
        replaysSessionSampleRate: 0.05,
    });
}

createRoot(document.getElementById("root")!).render(<App />);
