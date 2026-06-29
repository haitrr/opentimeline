import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/detectTrips", () => ({
  detectTripCandidates: vi.fn(),
}));

import { POST } from "@/app/api/trips/detect/route";
import { detectTripCandidates } from "@/lib/detectTrips";

type MockFn = ReturnType<typeof vi.fn>;

describe("POST /api/trips/detect", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns candidates from the clustering algorithm", async () => {
    const candidates = [
      { name: "San Francisco, CA · Dec 2024", startDate: "2024-12-23", endDate: "2024-12-26" },
    ];
    (detectTripCandidates as unknown as MockFn).mockResolvedValue(candidates);

    const res = await POST();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.candidates).toEqual(candidates);
  });

  it("returns empty candidates when no data", async () => {
    (detectTripCandidates as unknown as MockFn).mockResolvedValue([]);

    const res = await POST();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.candidates).toEqual([]);
  });

  it("returns 500 when detection throws", async () => {
    (detectTripCandidates as unknown as MockFn).mockRejectedValue(new Error("DB error"));
    const res = await POST();
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Detection failed");
  });
});
