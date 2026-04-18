import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { formatRelative } from "@/lib/relativeTime";

describe("formatRelative", () => {
  const NOW = new Date("2026-04-18T12:00:00").getTime();

  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  it("returns 'Never' for null", () => {
    expect(formatRelative(null)).toBe("Never");
  });

  it("returns 'Just now' under 60 seconds", () => {
    expect(formatRelative(new Date(NOW - 30_000).toISOString())).toBe("Just now");
  });

  it("returns minutes for <60m", () => {
    expect(formatRelative(new Date(NOW - 5 * 60_000).toISOString())).toBe("5m ago");
    expect(formatRelative(new Date(NOW - 59 * 60_000).toISOString())).toBe("59m ago");
  });

  it("returns hours for <24h (same day)", () => {
    expect(formatRelative(new Date(NOW - 2 * 3600_000).toISOString())).toBe("2h ago");
  });

  it("returns 'Yesterday' for calendar-yesterday", () => {
    expect(formatRelative(new Date("2026-04-17T23:30:00").toISOString())).toBe("Yesterday");
    expect(formatRelative(new Date("2026-04-17T00:05:00").toISOString())).toBe("Yesterday");
  });

  it("prefers 'Yesterday' over '{h}h ago' when crossing midnight within 24h", () => {
    // NOW is 2026-04-18T12:00. 23 hours earlier is 2026-04-17T13:00 — calendar-yesterday.
    expect(formatRelative(new Date("2026-04-17T13:00:00").toISOString())).toBe("Yesterday");
  });

  it("returns '{d}d ago' under 7 days (not yesterday)", () => {
    expect(formatRelative(new Date("2026-04-15T10:00:00").toISOString())).toBe("3d ago");
    expect(formatRelative(new Date("2026-04-12T10:00:00").toISOString())).toBe("6d ago");
  });

  it("returns 'MMM d' for same-year older than 7 days", () => {
    expect(formatRelative(new Date("2026-03-12T10:00:00").toISOString())).toBe("Mar 12");
  });

  it("returns 'MMM yyyy' for previous years", () => {
    expect(formatRelative(new Date("2025-03-12T10:00:00").toISOString())).toBe("Mar 2025");
  });
});
