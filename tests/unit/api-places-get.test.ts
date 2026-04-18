import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: vi.fn(),
    visit: {
      groupBy: vi.fn(),
    },
  },
}));

import { GET } from "@/app/api/places/route";
import { prisma } from "@/lib/prisma";

type MockFn = ReturnType<typeof vi.fn>;

function makeRequest(url: string) {
  // The GET handler only reads `request.nextUrl.searchParams`, so a minimal
  // stub with nextUrl set to a URL is enough.
  const parsed = new URL(url);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { nextUrl: parsed } as any;
}

const NOW = new Date("2026-04-18T12:00:00Z");

function mockRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 1,
    name: "Home",
    lat: 10,
    lon: 20,
    radius: 50,
    isActive: true,
    createdAt: NOW,
    lastVisitAt: null,
    confirmedVisits: BigInt(0),
    totalVisits: BigInt(0),
    ...overrides,
  };
}

describe("GET /api/places — pagination", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.visit.groupBy as MockFn).mockResolvedValue([]);
  });

  it("returns { places, nextOffset: null } when the result fits in one page", async () => {
    (prisma.$queryRaw as MockFn).mockResolvedValueOnce([
      mockRow({ id: 1, name: "Airport" }),
      mockRow({ id: 2, name: "Home" }),
    ]);

    const res = await GET(makeRequest("http://localhost/api/places?limit=50"));
    const body = await res.json();

    expect(body.places).toHaveLength(2);
    expect(body.nextOffset).toBeNull();
    expect(body.places[0].name).toBe("Airport");
  });

  it("sets nextOffset when the DB returns more than the limit", async () => {
    const rows = Array.from({ length: 6 }, (_, i) =>
      mockRow({ id: i + 1, name: `P${i + 1}` })
    );
    (prisma.$queryRaw as MockFn).mockResolvedValueOnce(rows);

    const res = await GET(makeRequest("http://localhost/api/places?limit=5&offset=0"));
    const body = await res.json();

    expect(body.places).toHaveLength(5);
    expect(body.nextOffset).toBe(5);
  });

  it("clamps limit to MAX_LIMIT and ignores invalid values", async () => {
    (prisma.$queryRaw as MockFn).mockResolvedValueOnce([]);
    await GET(makeRequest("http://localhost/api/places?limit=99999999"));
    // The raw query includes LIMIT (10000 + 1) when MAX_LIMIT=10000
    const call = (prisma.$queryRaw as MockFn).mock.calls[0];
    const sqlValues = call.slice(1);
    expect(sqlValues).toContain(10001);
  });

  it("applies start/end to the in-range groupBy only when both valid", async () => {
    (prisma.$queryRaw as MockFn).mockResolvedValueOnce([mockRow({ id: 7 })]);
    (prisma.visit.groupBy as MockFn).mockResolvedValueOnce([
      { placeId: 7, status: "confirmed", _count: { _all: 3 } },
      { placeId: 7, status: "suggested", _count: { _all: 1 } },
    ]);

    const url =
      "http://localhost/api/places?start=2026-01-01T00:00:00Z&end=2026-02-01T00:00:00Z";
    const res = await GET(makeRequest(url));
    const body = await res.json();

    expect(prisma.visit.groupBy).toHaveBeenCalledTimes(1);
    expect(body.places[0].confirmedVisitsInRange).toBe(3);
    expect(body.places[0].suggestedVisitsInRange).toBe(1);
    expect(body.places[0].visitsInRange).toBe(4);
  });

  it("skips the in-range groupBy when start/end are absent", async () => {
    (prisma.$queryRaw as MockFn).mockResolvedValueOnce([mockRow({ id: 8 })]);

    const res = await GET(makeRequest("http://localhost/api/places"));
    const body = await res.json();

    expect(prisma.visit.groupBy).not.toHaveBeenCalled();
    expect(body.places[0].confirmedVisitsInRange).toBe(0);
    expect(body.places[0].suggestedVisitsInRange).toBe(0);
  });

  it("includes search term in the WHERE clause when q is provided", async () => {
    (prisma.$queryRaw as MockFn).mockResolvedValueOnce([]);
    await GET(makeRequest("http://localhost/api/places?q=OfFicE"));
    // The outer $queryRaw call interpolates the whereClause Prisma.Sql object
    // as its first dynamic arg; the actual bound value lives on .values.
    const [, whereClause] = (prisma.$queryRaw as MockFn).mock.calls[0];
    const values: unknown[] = whereClause.values ?? [];
    expect(values).toContain("%office%");
  });

  it("defaults sort to 'recent' and falls back for invalid sort values", async () => {
    (prisma.$queryRaw as MockFn).mockResolvedValueOnce([]);
    const res = await GET(makeRequest("http://localhost/api/places?sort=bogus"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.places).toEqual([]);
    expect(body.nextOffset).toBeNull();
  });
});
