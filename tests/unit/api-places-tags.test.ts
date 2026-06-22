import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: vi.fn(),
    visit: { groupBy: vi.fn() },
    placeTag: { findMany: vi.fn() },
  },
}));

import { GET } from "@/app/api/places/route";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

type MockFn = ReturnType<typeof vi.fn>;

function makeRequest(params: Record<string, string> = {}) {
  const sp = new URLSearchParams(params);
  return new NextRequest(`http://localhost/api/places?${sp}`);
}

const PLACE_ROW = {
  id: 1,
  name: "Home",
  lat: 10,
  lon: 20,
  radius: 50,
  isActive: true,
  createdAt: new Date("2025-01-01"),
  parentId: null,
  parentName: null,
  childCount: BigInt(0),
  lastVisitAt: null,
  confirmedVisits: BigInt(5),
  totalVisits: BigInt(5),
};

describe("GET /api/places — tags", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.visit.groupBy as unknown as MockFn).mockResolvedValue([]);
    (prisma.placeTag.findMany as unknown as MockFn).mockResolvedValue([
      { placeId: 1, tag: { name: "coffee" } },
      { placeId: 1, tag: { name: "work" } },
    ]);
  });

  it("includes tags array in each place in the response", async () => {
    (prisma.$queryRaw as unknown as MockFn)
      .mockResolvedValueOnce([PLACE_ROW])
      .mockResolvedValueOnce([{ count: BigInt(1) }]);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(body.places[0].tags).toEqual(["coffee", "work"]);
  });

  it("returns empty tags array when place has no tags", async () => {
    (prisma.$queryRaw as unknown as MockFn)
      .mockResolvedValueOnce([PLACE_ROW])
      .mockResolvedValueOnce([{ count: BigInt(1) }]);
    (prisma.placeTag.findMany as unknown as MockFn).mockResolvedValue([]);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(body.places[0].tags).toEqual([]);
  });
});
