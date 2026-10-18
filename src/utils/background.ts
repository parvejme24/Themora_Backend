import { waitUntil } from "@vercel/functions";

// Runs work after the response is sent. On Vercel, waitUntil keeps the
// function alive until the promise settles; elsewhere it simply runs.
// Failures are logged, never thrown.
export const runInBackground = (label: string, work: () => Promise<unknown>) => {
  // Promise.resolve().then also catches synchronous throws and non-promise returns
  const promise = Promise.resolve().then(work).catch((error) => {
    console.error(`Background task "${label}" failed:`, error);
  });
  try {
    waitUntil(promise);
  } catch {
    // Not running inside a Vercel request context
  }
};
