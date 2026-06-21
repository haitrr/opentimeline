import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    visit: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    place: {
      findUnique: vi.fn(),
    },
  },
}));

import { GET, POST } from "@/app/api/visits/route";
import { PUT } from "@/app/api/visits/[id]/route";
import { prisma } from "@/lib/prisma";

type MockFn = ReturnType<typeof vi.fn>;

const PLACE = { id: 1, name: "Home", lat: 10, lon: 20, radius: 50 };

function makeRequest(url: string, init?: RequestInit) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new Request(url, init) as any;
}

function makeParams(id: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { params: Promise.resolve({ id }) } as any;
}

describe("Visit notes — API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET /api/visits includes notes in response", async () => {
    (prisma.visit.findMany as MockFn).mockResolvedValue([
      {
        id: 1,
        placeId: 1,
        arrivalAt: new Date("2026-05-01T10:00:00Z"),
        departureAt: new Date("2026-05-01T12:00:00Z"),
        status: "confirmed",
        pointCount: 5,
        notes: "Had a great time",
        createdAt: new Date(),
        place: PLACE,
        parentVisitId: null,
        childVisits: [],
      },
    ]);

    const res = await GET(makeRequest("http://localhost/api/visits"));
    const body = await res.json();

    expect(body[0].notes).toBe("Had a great time");
  });

  it("GET /api/visits returns null notes when not set", async () => {
    (prisma.visit.findMany as MockFn).mockResolvedValue([
      {
        id: 1,
        placeId: 1,
        arrivalAt: new Date("2026-05-01T10:00:00Z"),
        departureAt: new Date("2026-05-01T12:00:00Z"),
        status: "confirmed",
        pointCount: 5,
        notes: null,
        createdAt: new Date(),
        place: PLACE,
        parentVisitId: null,
        childVisits: [],
      },
    ]);

    const res = await GET(makeRequest("http://localhost/api/visits"));
    const body = await res.json();

    expect(body[0].notes).toBeNull();
  });

  it("PUT /api/visits/[id] persists notes", async () => {
    const existing = {
      id: 1,
      placeId: 1,
      arrivalAt: new Date("2026-05-01T10:00:00Z"),
      departureAt: new Date("2026-05-01T12:00:00Z"),
      status: "confirmed",
      pointCount: 5,
      notes: null,
      createdAt: new Date(),
    };
    (prisma.visit.findUnique as MockFn).mockResolvedValue(existing);
    (prisma.place.findUnique as MockFn).mockResolvedValue(PLACE);
    (prisma.visit.update as MockFn).mockResolvedValue({ ...existing, notes: "My note" });

    const res = await PUT(
      makeRequest("http://localhost/api/visits/1", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          placeId: 1,
          arrivalAt: "2026-05-01T10:00:00Z",
          departureAt: "2026-05-01T12:00:00Z",
          status: "confirmed",
          notes: "My note",
        }),
      }),
      makeParams("1")
    );
    const body = await res.json();

    expect(prisma.visit.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ notes: "My note" }),
      })
    );
    expect(body.notes).toBe("My note");
  });

  it("POST /api/visits persists notes on creation", async () => {
    (prisma.visit.create as MockFn).mockResolvedValue({
      id: 2,
      placeId: 1,
      arrivalAt: new Date("2026-05-01T10:00:00Z"),
      departureAt: new Date("2026-05-01T12:00:00Z"),
      status: "confirmed",
      pointCount: 0,
      notes: "First visit note",
      createdAt: new Date(),
      place: PLACE,
    });

    const res = await POST(
      makeRequest("http://localhost/api/visits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          placeId: 1,
          arrivalAt: "2026-05-01T10:00:00Z",
          departureAt: "2026-05-01T12:00:00Z",
          notes: "First visit note",
        }),
      })
    );
    const body = await res.json();

    expect(prisma.visit.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ notes: "First visit note" }),
      })
    );
    expect(body.notes).toBe("First visit note");
  });
});
