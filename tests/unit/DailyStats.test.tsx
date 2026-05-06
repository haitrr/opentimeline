import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import DailyStats from "@/components/DailyStats";
import type { DailyStats as DailyStatsData } from "@/lib/groupByHour";

function makeStats(overrides: Partial<DailyStatsData> = {}): DailyStatsData {
  return {
    totalPoints: 4321,
    totalDistanceKm: 12.34,
    durationMinutes: 120,
    daysWithData: 7,
    groups: [],
    ...overrides,
  };
}

describe("DailyStats", () => {
  it("renders distance and points", () => {
    render(<DailyStats stats={makeStats()} />);

    expect(screen.getByText("Distance")).toBeInTheDocument();
    expect(screen.getByText("12.3 km")).toBeInTheDocument();
    expect(screen.getByText("Points")).toBeInTheDocument();
    expect(screen.getByText("4321")).toBeInTheDocument();
  });

  it("does not show days with data as a stat", () => {
    render(<DailyStats stats={makeStats({ totalPoints: 9, daysWithData: 7 })} />);

    expect(screen.queryByText("Days")).not.toBeInTheDocument();
    expect(screen.getByText("9")).toBeInTheDocument();
  });
});
