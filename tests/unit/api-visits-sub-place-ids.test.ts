import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    visit: {
      findMany: vi.fn(),
    },
  },
}));

import { GET } from "@/app/api/visits/route";
import { prisma } from "@/lib/prisma";

type MockFn = ReturnType<typeof vi.fn>;

function makeRequest(url: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new Request(url) as any;
}

const PLACE = { id: 1, name: "Mall", lat: 10, lon: 20, radius: 200 };

describe("GET /api/visits — checkedSubPlaceIds", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("includes checkedSubPlaceIds on each visit based on childVisits links", async () => {
    const parentVisit = {
      id: 10,
      placeId: 1,
      arrivalAt: new Date("2026-05-01T10:00:00Z"),
      departureAt: new Date("2026-05-01T12:00:00Z"),
      status: "confirmed",
      pointCount: 5,
      createdAt: new Date(),
      place: PLACE,
      parentVisitId: null,
      childVisits: [
        { id: 20, placeId: 99 },
        { id: 21, placeId: 100 },
      ],
    };

    (prisma.visit.findMany as MockFn).mockResolvedValue([parentVisit]);

    const res = await GET(makeRequest("http://localhost/api/visits?placeId=1"));
    const body = await res.json();

    expect(body[0].checkedSubPlaceIds).toEqual([99, 100]);
  });

  it("returns empty checkedSubPlaceIds when visit has no child visits", async () => {
    const visit = {
      id: 10,
      placeId: 1,
      arrivalAt: new Date("2026-05-01T10:00:00Z"),
      departureAt: new Date("2026-05-01T12:00:00Z"),
      status: "confirmed",
      pointCount: 5,
      createdAt: new Date(),
      place: PLACE,
      parentVisitId: null,
      childVisits: [],
    };

    (prisma.visit.findMany as MockFn).mockResolvedValue([visit]);

    const res = await GET(makeRequest("http://localhost/api/visits?placeId=1"));
    const body = await res.json();

    expect(body[0].checkedSubPlaceIds).toEqual([]);
  });
});
