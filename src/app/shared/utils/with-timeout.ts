/** Default wait for a Firestore read before telling the user that the connection is not answering. */
export const LOAD_TIMEOUT_MS = 15000;

/**
 * Rejects when the promise does not settle in time, so a stalled connection shows an error with "Riprova"
 * instead of an endless loading state. The error uses Firestore's `deadline-exceeded` code.
 */
export function withTimeout<T>(promise: Promise<T>, timeoutMs = LOAD_TIMEOUT_MS): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(Object.assign(new Error('Timeout'), { code: 'deadline-exceeded' })), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
