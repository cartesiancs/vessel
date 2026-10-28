export const RECONNECT_BASE_DELAY_MS = 500;
export const RECONNECT_MAX_DELAY_MS = 10_000;
const RECONNECT_JITTER = 0.2;

/** Exponential backoff with +/-20% jitter so many viewers do not reconnect in lockstep. */
export function reconnectDelayMs(
  attempt: number,
  random: () => number = Math.random,
): number {
  const base = Math.min(
    RECONNECT_BASE_DELAY_MS * 2 ** attempt,
    RECONNECT_MAX_DELAY_MS,
  );
  const jitter = (random() * 2 - 1) * RECONNECT_JITTER;
  return Math.round(base * (1 + jitter));
}

/**
 * Schedules reconnect attempts after a socket closes. One attempt is pending at a time; a
 * successful open resets the backoff; stop() cancels everything (used on unmount/logout).
 */
export class Reconnector {
  private attempt = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;

  constructor(
    private readonly reconnect: () => void | Promise<void>,
    private readonly random: () => number = Math.random,
  ) {}

  onOpen(): void {
    this.attempt = 0;
  }

  onClose(): void {
    if (this.stopped || this.timer !== null) {
      return;
    }
    const delay = reconnectDelayMs(this.attempt, this.random);
    this.attempt += 1;
    this.timer = setTimeout(() => {
      this.timer = null;
      if (this.stopped) {
        return;
      }
      void Promise.resolve(this.reconnect()).catch((err) => {
        console.warn("[ws] reconnect attempt failed:", err);
        this.onClose();
      });
    }, delay);
  }

  stop(): void {
    this.stopped = true;
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
