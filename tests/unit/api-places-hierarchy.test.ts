import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: vi.fn(),
    visit: { groupBy: vi.fn() },
  },
}));

import { GET } from "@/app/api/places/route";
import { prisma } from "@/lib/prisma";

type MockFn = ReturnType<typeof vi.fn>;

const NOW = new Date("2026-05-02T12:00:00Z");

function mockRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 1,
    name: "Home",
    lat: 10,
    lon: 20,
    radius: 50,
    isActive: true,
    createdAt: NOW,
    parentId: null,
    childCount: BigInt(0),
    lastVisitAt: null,
    confirmedVisits: BigInt(0),
    totalVisits: BigInt(0),
    ...overrides,
  };
}

function makeRequest(url: string) {
  const parsed = new URL(url);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { nextUrl: parsed } as any;
}

describe("GET /api/places — hierarchy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.visit.groupBy as MockFn).mockResolvedValue([]);
  });

  it("returns parentId and childCount in each place", async () => {
    (prisma.$queryRaw as MockFn).mockResolvedValueOnce([
      mockRow({ id: 1, parentId: null, childCount: BigInt(2) }),
    ]);

    const res = await GET(makeRequest("http://localhost/api/places"));
    const body = await res.json();

    expect(body.places[0].parentId).toBeNull();
    expect(body.places[0].childCount).toBe(2);
  });

  it("returns only rows when no parentId param (root places filter active)", async () => {
    (prisma.$queryRaw as MockFn).mockResolvedValueOnce([
      mockRow({ id: 1, parentId: null, childCount: BigInt(0) }),
      mockRow({ id: 2, parentId: null, childCount: BigInt(1) }),
    ]);

    const res = await GET(makeRequest("http://localhost/api/places"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.places).toHaveLength(2);
    expect(body.places.every((p: { parentId: null }) => p.parentId === null)).toBe(true);
  });

  it("returns places when ?parentId=5 is provided", async () => {
    (prisma.$queryRaw as MockFn).mockResolvedValueOnce([
      mockRow({ id: 10, parentId: 5, childCount: BigInt(0) }),
      mockRow({ id: 11, parentId: 5, childCount: BigInt(0) }),
    ]);

    const res = await GET(makeRequest("http://localhost/api/places?parentId=5"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.places).toHaveLength(2);
    expect(body.places[0].parentId).toBe(5);
  });
});
