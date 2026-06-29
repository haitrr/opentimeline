import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trip: {
      findMany: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    visit: { count: vi.fn() },
  },
}));

import { GET, POST } from "@/app/api/trips/route";
import { PUT, DELETE } from "@/app/api/trips/[id]/route";
import { prisma } from "@/lib/prisma";

type MockFn = ReturnType<typeof vi.fn>;

function req(body?: unknown, url = "http://localhost/api/trips") {
  return {
    json: async () => body,
    nextUrl: { searchParams: new URLSearchParams() },
  } as unknown as import("next/server").NextRequest;
}

function reqWithBody(body: unknown, url = "http://localhost/api/trips") {
  return {
    json: async () => body,
  } as unknown as import("next/server").NextRequest;
}

function params(id: string) {
  return { params: Promise.resolve({ id }) };
}

const FAKE_TRIP = {
  id: 1,
  name: "Christmas in SF",
  startDate: new Date("2024-12-23T00:00:00Z"),
  endDate: new Date("2024-12-26T23:59:59Z"),
  createdAt: new Date("2024-12-27T10:00:00Z"),
};

describe("GET /api/trips", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns trips with visitCount ordered by startDate desc", async () => {
    (prisma.trip.findMany as unknown as MockFn).mockResolvedValue([FAKE_TRIP]);
    (prisma.visit.count as unknown as MockFn).mockResolvedValue(3);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.trips).toHaveLength(1);
    expect(body.trips[0].visitCount).toBe(3);
    expect(body.trips[0].name).toBe("Christmas in SF");
    expect(prisma.trip.findMany).toHaveBeenCalledWith({ orderBy: { startDate: "desc" } });
  });
});

describe("POST /api/trips", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a trip and returns 201", async () => {
    (prisma.trip.create as unknown as MockFn).mockResolvedValue(FAKE_TRIP);

    const res = await POST(reqWithBody({
      name: "Christmas in SF",
      startDate: "2024-12-23T00:00:00Z",
      endDate: "2024-12-26T23:59:59Z",
    }));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.trip.name).toBe("Christmas in SF");
  });

  it("returns 400 when name is missing", async () => {
    const res = await POST(reqWithBody({ startDate: "2024-12-23", endDate: "2024-12-26" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when startDate >= endDate", async () => {
    const res = await POST(reqWithBody({
      name: "Bad trip",
      startDate: "2024-12-26",
      endDate: "2024-12-23",
    }));
    expect(res.status).toBe(400);
  });
});

describe("PUT /api/trips/:id", () => {
  beforeEach(() => vi.clearAllMocks());

  it("updates name and returns the trip", async () => {
    (prisma.trip.findUnique as unknown as MockFn).mockResolvedValue(FAKE_TRIP);
    (prisma.trip.update as unknown as MockFn).mockResolvedValue({ ...FAKE_TRIP, name: "Updated" });

    const res = await PUT(reqWithBody({ name: "Updated" }), params("1"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.trip.name).toBe("Updated");
  });

  it("returns 404 when trip not found", async () => {
    (prisma.trip.findUnique as unknown as MockFn).mockResolvedValue(null);
    const res = await PUT(reqWithBody({ name: "X" }), params("99"));
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/trips/:id", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deletes the trip and returns deleted:true", async () => {
    (prisma.trip.findUnique as unknown as MockFn).mockResolvedValue(FAKE_TRIP);
    (prisma.trip.delete as unknown as MockFn).mockResolvedValue(FAKE_TRIP);

    const res = await DELETE(params("1"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.deleted).toBe(true);
  });

  it("returns 404 when trip not found", async () => {
    (prisma.trip.findUnique as unknown as MockFn).mockResolvedValue(null);
    const res = await DELETE(params("99"));
    expect(res.status).toBe(404);
  });
});
