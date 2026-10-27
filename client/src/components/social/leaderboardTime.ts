const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** "Resets in 3d 4h" until next Monday 00:00 UTC, from the server's `weekStart` (YYYY-MM-DD). */
export function resetLabel(weekStart: string, now: number = Date.now()): string | null {
  const start = Date.parse(`${weekStart}T00:00:00Z`);
  if (Number.isNaN(start)) return null;
  const left = start + WEEK_MS - now;
  if (left <= 0) return 'Resetting now';
  const hours = Math.floor(left / 3_600_000);
  const days = Math.floor(hours / 24);
  if (days > 0) return `Resets in ${days}d ${hours % 24}h`;
  const mins = Math.floor((left % 3_600_000) / 60_000);
  return hours > 0 ? `Resets in ${hours}h ${mins}m` : `Resets in ${Math.max(1, mins)}m`;
}

/** "Week of Oct 26" for the ISO week starting `weekStart`. */
export function weekLabel(weekStart: string): string {
  const d = new Date(`${weekStart}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return 'This week';
  return `Week of ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}`;
}
