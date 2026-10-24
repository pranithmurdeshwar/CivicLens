/** Small id/time helpers. */

const RANDOM_SUFFIX = () => Math.random().toString(36).slice(2, 8);

export function uid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${RANDOM_SUFFIX()}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function msAgo(ms: number): string {
  return new Date(Date.now() - ms).toISOString();
}

export const DAY_MS = 86_400_000;
export const HOUR_MS = 3_600_000;

export function daysAgo(days: number): string {
  return msAgo(days * DAY_MS);
}

export function hoursAgo(hours: number): string {
  return msAgo(hours * HOUR_MS);
}
