export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export function formatPct(v: number, digits = 1): string {
  return `${(v * 100).toFixed(digits)}%`;
}

export function formatPP(v: number, digits = 1): string {
  const sign = v > 0 ? "+" : "";
  return `${sign}${(v * 100).toFixed(digits)} pp`;
}

export function formatDuration(hours: number): string {
  if (hours < 1) {
    const mins = Math.round(hours * 60);
    return `${mins}m`;
  }
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function formatCountdown(dueAt: string, now: Date = new Date()): { label: string; overdue: boolean; urgency: "calm" | "warning" | "critical" } {
  const due = new Date(dueAt).getTime();
  const diffMs = due - now.getTime();
  const overdue = diffMs < 0;
  const abs = Math.abs(diffMs);
  const hours = abs / 36e5;
  const days = Math.floor(hours / 24);
  const remHours = Math.floor(hours % 24);
  const mins = Math.floor((abs % 36e5) / 60000);

  let label: string;
  if (days > 0) {
    label = `${days}d ${String(remHours).padStart(2, "0")}h`;
  } else if (hours >= 1) {
    label = `${remHours}h ${mins}m`;
  } else {
    label = `${mins}m`;
  }

  let urgency: "calm" | "warning" | "critical" = "calm";
  if (overdue) urgency = "critical";
  else if (hours < 24) urgency = "warning";

  return { label: overdue ? `OVERDUE · ${label}` : `${label} remaining`, overdue, urgency };
}

export function relativeTime(iso: string, now: Date = new Date()): string {
  const diffMs = now.getTime() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return `${days}d ago`;
}

export function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatClock(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", second: "2-digit" });
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/** Deterministic pseudo-random generator (mulberry32) so demo data is stable across reloads within a session seed. */
export function mulberry32(seed: number) {
  let a = seed;
  return function rand() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick<T>(rand: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}

export function randInt(rand: () => number, min: number, max: number): number {
  return Math.floor(rand() * (max - min + 1)) + min;
}
