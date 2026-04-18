import { format, isYesterday } from "date-fns";

export function formatRelative(iso: string | null): string {
  if (!iso) return "Never";
  const date = new Date(iso);
  const now = Date.now();
  const diffMs = now - date.getTime();

  if (diffMs < 60_000) return "Just now";

  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 60) return `${diffMin}m ago`;

  const sameDay =
    date.getFullYear() === new Date(now).getFullYear() &&
    date.getMonth() === new Date(now).getMonth() &&
    date.getDate() === new Date(now).getDate();
  const diffHour = Math.floor(diffMs / 3_600_000);
  if (sameDay && diffHour < 24) return `${diffHour}h ago`;

  if (isYesterday(date)) return "Yesterday";

  const diffDay = Math.floor(diffMs / 86_400_000);
  if (diffDay < 7) return `${diffDay}d ago`;

  if (date.getFullYear() === new Date(now).getFullYear()) {
    return format(date, "MMM d");
  }
  return format(date, "MMM yyyy");
}
