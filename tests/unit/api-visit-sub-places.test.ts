import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    visit: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      createMany: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

import { PUT } from "@/app/api/visits/[id]/sub-places/route";
import { prisma } from "@/lib/prisma";

type MockFn = ReturnType<typeof vi.fn>;

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) } as Parameters<typeof PUT>[1];
}

function makeRequest(body: unknown) {
  return new Request("http://localhost", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any;
}

const PARENT_VISIT = {
  id: 10,
  placeId: 1,
  arrivalAt: new Date("2026-05-01T10:00:00Z"),
  departureAt: new Date("2026-05-01T12:00:00Z"),
  status: "confirmed",
  parentVisitId: null,
};

describe("PUT /api/visits/[id]/sub-places", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.visit.findUnique as MockFn).mockResolvedValue(PARENT_VISIT);
    (prisma.visit.findMany as MockFn).mockResolvedValue([]);
    (prisma.visit.createMany as MockFn).mockResolvedValue({ count: 0 });
    (prisma.visit.deleteMany as MockFn).mockResolvedValue({ count: 0 });
  });

  it("returns 400 for non-numeric id", async () => {
    const res = await PUT(makeRequest({ subPlaceIds: [] }), makeParams("abc"));
    expect(res.status).toBe(400);
  });

  it("returns 404 when parent visit not found", async () => {
    (prisma.visit.findUnique as MockFn).mockResolvedValue(null);
    const res = await PUT(makeRequest({ subPlaceIds: [99] }), makeParams("10"));
    expect(res.status).toBe(404);
  });

  it("returns 400 for non-array subPlaceIds", async () => {
    const res = await PUT(makeRequest({ subPlaceIds: "bad" }), makeParams("10"));
    expect(res.status).toBe(400);
  });

  it("creates child visits for newly checked sub-places", async () => {
    (prisma.visit.findMany as MockFn).mockResolvedValue([]);
    (prisma.visit.createMany as MockFn).mockResolvedValue({ count: 2 });
    (prisma.visit.findMany as MockFn)
      .mockResolvedValueOnce([]) // existing child visits
      .mockResolvedValueOnce([  // updated child visits
        { id: 20, placeId: 99 },
        { id: 21, placeId: 100 },
      ]);

    const res = await PUT(makeRequest({ subPlaceIds: [99, 100] }), makeParams("10"));

    expect(res.status).toBe(200);
    expect(prisma.visit.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ placeId: 99, parentVisitId: 10, status: "confirmed" }),
        expect.objectContaining({ placeId: 100, parentVisitId: 10, status: "confirmed" }),
      ]),
    });
  });

  it("deletes child visits for unchecked sub-places", async () => {
    (prisma.visit.findMany as MockFn)
      .mockResolvedValueOnce([
        { id: 20, placeId: 99 },
        { id: 21, placeId: 100 },
      ])
      .mockResolvedValueOnce([{ id: 20, placeId: 99 }]);
    (prisma.visit.deleteMany as MockFn).mockResolvedValue({ count: 1 });

    const res = await PUT(makeRequest({ subPlaceIds: [99] }), makeParams("10"));

    expect(res.status).toBe(200);
    expect(prisma.visit.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: [21] } },
    });
  });

  it("is idempotent — no creates or deletes when checked matches existing", async () => {
    (prisma.visit.findMany as MockFn)
      .mockResolvedValueOnce([{ id: 20, placeId: 99 }])
      .mockResolvedValueOnce([{ id: 20, placeId: 99 }]);

    const res = await PUT(makeRequest({ subPlaceIds: [99] }), makeParams("10"));

    expect(res.status).toBe(200);
    expect(prisma.visit.createMany).not.toHaveBeenCalled();
    expect(prisma.visit.deleteMany).not.toHaveBeenCalled();
  });
});
