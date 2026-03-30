/**
 * Production-safe logging utility
 * Only logs in development mode, silent in production
 */

const isDev = import.meta.env.DEV;

export const logger = {
    log: (...args: any[]) => {
        if (isDev) {
            console.log(...args);
        }
    },

    error: (...args: any[]) => {
        if (isDev) {
            console.error(...args);
        }
        // In production, you could send errors to a service like Sentry
        // Example: Sentry.captureException(args[0]);
    },

    warn: (...args: any[]) => {
        if (isDev) {
            console.warn(...args);
        }
    },

    info: (...args: any[]) => {
        if (isDev) {
            console.info(...args);
        }
    },

    debug: (...args: any[]) => {
        if (isDev) {
            console.debug(...args);
        }
    },
};
