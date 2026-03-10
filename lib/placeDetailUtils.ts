import { differenceInYears, differenceInMonths, differenceInDays } from "date-fns";

export const MIN_GAP_PX = 10;
export const MAX_GAP_PX = 80;
export const YEAR_BADGE_MIN_PX = 32;

export function parseTimeMs(value: string): number | null {
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

export function formatVisitSpan(from: Date, to: Date): string {
  const totalYears = differenceInYears(to, from);
  if (totalYears >= 1) {
    const remainMonths = differenceInMonths(to, from) - totalYears * 12;
    return remainMonths > 0 ? `${totalYears} yr ${remainMonths} mo` : `${totalYears} yr`;
  }
  const totalMonths = differenceInMonths(to, from);
  if (totalMonths >= 1) return `${totalMonths} mo`;
  const totalDays = differenceInDays(to, from);
  return `${Math.max(1, totalDays)} day${totalDays !== 1 ? "s" : ""}`;
}

export function formatGapMs(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "";
  const totalMinutes = Math.round(ms / 60000);
  if (totalMinutes < 60) return `${Math.max(1, totalMinutes)}m`;
  const totalHours = Math.floor(totalMinutes / 60);
  if (totalHours < 24) {
    const rem = totalMinutes % 60;
    return rem > 0 ? `${totalHours}h ${rem}m` : `${totalHours}h`;
  }
  const totalDays = Math.floor(ms / 86400000);
  if (totalDays < 31) return `${totalDays}d`;
  const totalMonths = Math.round(totalDays / 30.44);
  if (totalMonths < 12) return `${totalMonths}mo`;
  const years = Math.floor(totalMonths / 12);
  const remMonths = totalMonths % 12;
  return remMonths > 0 ? `${years}yr ${remMonths}mo` : `${years}yr`;
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function toDateTimeLocalValue(value: string): string {
  const date = new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

export function gapToPx(
  gapMs: number,
  minMs: number,
  maxMs: number,
  yearChanges: boolean
): number {
  if (!Number.isFinite(gapMs) || gapMs < 0) {
    return yearChanges ? YEAR_BADGE_MIN_PX : MIN_GAP_PX;
  }
  if (!Number.isFinite(minMs) || !Number.isFinite(maxMs)) {
    return yearChanges ? Math.max(MIN_GAP_PX, YEAR_BADGE_MIN_PX) : MIN_GAP_PX;
  }
  let px: number;
  if (minMs === maxMs) {
    px = (MIN_GAP_PX + MAX_GAP_PX) / 2;
  } else {
    const t =
      (Math.log(gapMs + 1) - Math.log(minMs + 1)) /
      (Math.log(maxMs + 1) - Math.log(minMs + 1));
    px = MIN_GAP_PX + Math.max(0, Math.min(1, t)) * (MAX_GAP_PX - MIN_GAP_PX);
  }
  const safePx = Number.isFinite(px) ? px : MIN_GAP_PX;
  return yearChanges ? Math.max(safePx, YEAR_BADGE_MIN_PX) : safePx;
}
