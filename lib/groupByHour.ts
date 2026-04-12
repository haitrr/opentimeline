export type SerializedPoint = {
  id: number;
  lat: number;
  lon: number;
  tst: number;
  recordedAt: string;
  acc: number | null;
  batt: number | null;
  tid: string | null;
  alt: number | null;
  vel: number | null;
};

export type TimeGroup = {
  key: string;
  label: string;
  distanceKm: number;
};

export type HourGroup = TimeGroup;

export type DailyStats = {
  totalPoints: number;
  totalDistanceKm: number;
  durationMinutes: number;
  daysWithData: number;
  groups: TimeGroup[];
};
