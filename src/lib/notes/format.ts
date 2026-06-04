export function formatRelative(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.round(diff / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** Whole-day diff between today and the given timestamp (>=0 = upcoming). */
export function daysUntil(ts: number): number {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const target = new Date(ts);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - start.getTime()) / 86400000);
}

export function formatTestCountdown(ts: number, subjectLabel?: string): string {
  const d = daysUntil(ts);
  const subject = subjectLabel?.trim() || "Test";
  if (d < 0) return `${subject} was ${Math.abs(d)} day${Math.abs(d) === 1 ? "" : "s"} ago`;
  if (d === 0) return `${subject} test is today`;
  if (d === 1) return `${subject} test tomorrow`;
  return `${subject} test in ${d} days`;
}
