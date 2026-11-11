import * as Sentry from "@sentry/nextjs";

// Sentry solo se activa si existe SENTRY_DSN (o NEXT_PUBLIC_SENTRY_DSN).
export async function register() {
  const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return;
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
  });
}

export const onRequestError = Sentry.captureRequestError;
