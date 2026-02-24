import {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  parseISO,
} from "date-fns";
import type { RangeType } from "@/app/timeline/[date]/page";

export function getRangeBounds(
  date: Date,
  rangeType: RangeType,
  endDateStr?: string
): { start: Date; end: Date } {
  switch (rangeType) {
    case "week":
      return {
        start: startOfWeek(date, { weekStartsOn: 1 }),
        end: endOfWeek(date, { weekStartsOn: 1 }),
      };
    case "month":
      return { start: startOfMonth(date), end: endOfMonth(date) };
    case "year":
      return { start: startOfYear(date), end: endOfYear(date) };
    case "custom": {
      const endDate = endDateStr ? parseISO(endDateStr) : date;
      return { start: startOfDay(date), end: endOfDay(endDate) };
    }
    default:
      return { start: startOfDay(date), end: endOfDay(date) };
  }
}
