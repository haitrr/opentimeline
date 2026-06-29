import { format, parseISO } from "date-fns";

export type Trip = {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  visitCount: number;
  createdAt: string;
};

export type TripCandidate = {
  name: string;
  startDate: string;
  endDate: string;
};

export type FormState = { name: string; startDate: string; endDate: string };

export const EMPTY_FORM: FormState = { name: "", startDate: "", endDate: "" };

export function formatDateRange(startDate: string, endDate: string): string {
  const start = parseISO(startDate);
  const end = parseISO(endDate);
  const sameYear = start.getFullYear() === end.getFullYear();
  const startFmt = sameYear ? format(start, "MMM d") : format(start, "MMM d, yyyy");
  const endFmt = format(end, "MMM d, yyyy");
  return `${startFmt} – ${endFmt}`;
}
