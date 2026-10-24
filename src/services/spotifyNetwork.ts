/** Bound the whole request, including a body that stalls after headers arrive.
 * Commands are never retried automatically: Spotify may have applied them.
 */
export async function fetchWithDeadline<T>(
  url: string,
  options: RequestInit,
  consume: (response: Response) => Promise<T>,
  timeoutMs = 15_000,
): Promise<T> {
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      reject(Object.assign(new Error('Spotify connection timed out. Check your connection and try again.'), { code: 'SPOTIFY_TIMEOUT' }));
      controller.abort();
    }, timeoutMs);
  });
  try {
    // Race also releases callers on platforms where abort does not settle a body read.
    return await Promise.race([
      fetch(url, { ...options, signal: controller.signal }).then(response => {
        if (controller.signal.aborted) throw new Error('Spotify request has already timed out.');
        return consume(response);
      }),
      deadline,
    ]);
  } finally {
    clearTimeout(timeout);
  }
}
