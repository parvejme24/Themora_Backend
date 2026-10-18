import * as Sentry from "@sentry/node";
import pino from "pino";
import { env } from "./env";

// Error tracking is enabled only when SENTRY_DSN is set
const sentryEnabled = Boolean(env.SENTRY_DSN) && env.NODE_ENV !== "test";
if (sentryEnabled) {
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.VERCEL ? "production" : env.NODE_ENV,
    tracesSampleRate: 0,
    sendDefaultPii: false,
  });
}

export const logger = pino({
  level: env.NODE_ENV === "test" ? "silent" : env.LOG_LEVEL,
  redact: {
    paths: ["req.headers.authorization", "req.headers.cookie", 'req.headers["x-nextauth-secret"]', 'req.headers["stripe-signature"]'],
    remove: true,
  },
});

export const captureError = (error: unknown, context?: Record<string, unknown>) => {
  logger.error({ err: error, ...context }, error instanceof Error ? error.message : "Unexpected error");
  if (sentryEnabled) Sentry.captureException(error, context ? { extra: context } : undefined);
};

// Serverless functions can freeze right after responding; send queued events first
export const flushMonitoring = () => (sentryEnabled ? Sentry.flush(2000) : Promise.resolve(true));
