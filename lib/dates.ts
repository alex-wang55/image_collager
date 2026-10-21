const sameYear = (d: Date) => d.getFullYear() === new Date().getFullYear();

/** "Oct 21" this year, "Oct 21, 2024" otherwise. */
export function shortDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, sameYear(d) ? { month: "short", day: "numeric" } : { month: "short", day: "numeric", year: "numeric" });
}

/** "Saturday, October 21, 2026" */
export function longDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

/** "October 2026", for timeline headings. */
export function monthLabel(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

export function monthKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}`;
}

/** "Jun – Oct 2026", "Dec 2025 – Feb 2026", or "Oct 2026" for a board's span. */
export function spanLabel(fromIso: string, toIso: string): string {
  const a = new Date(fromIso);
  const b = new Date(toIso);
  const m = (d: Date) => d.toLocaleDateString(undefined, { month: "short" });
  if (a.getFullYear() === b.getFullYear()) {
    return a.getMonth() === b.getMonth() ? `${m(a)} ${a.getFullYear()}` : `${m(a)} – ${m(b)} ${b.getFullYear()}`;
  }
  return `${m(a)} ${a.getFullYear()} – ${m(b)} ${b.getFullYear()}`;
}

/** "today", "yesterday", "3 days ago", "2 months ago", "a year ago". */
export function ago(iso: string): string {
  const days = Math.floor((startOfDay(new Date()) - startOfDay(new Date(iso))) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 14) return "a week ago";
  if (days < 31) return `${Math.floor(days / 7)} weeks ago`;
  const months = Math.floor(days / 30.44);
  if (months < 2) return "a month ago";
  if (months < 12) return `${months} months ago`;
  const years = Math.floor(days / 365.25);
  return years <= 1 ? "a year ago" : `${years} years ago`;
}

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}
