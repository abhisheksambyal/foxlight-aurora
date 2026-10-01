const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Runs `fn`, retrying after each delay (ms) on failure; rethrows the last error. */
export async function withRetry<T>(fn: () => Promise<T>, delays: number[]): Promise<T> {
  for (let i = 0; ; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i >= delays.length) throw e;
      await sleep(delays[i]);
    }
  }
}
