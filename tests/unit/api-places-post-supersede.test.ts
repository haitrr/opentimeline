import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    place: { create: vi.fn() },
    visit: {
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      findMany: vi.fn(),
    },
    unknownVisitSuggestion: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/detectVisits", () => ({
  detectVisitsForPlace: vi.fn(),
}));

import { POST } from "@/app/api/places/route";
import { prisma } from "@/lib/prisma";
import { detectVisitsForPlace } from "@/lib/detectVisits";

type MockFn = ReturnType<typeof vi.fn>;

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/places", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any;
}

describe("POST /api/places — supersedesVisitId", () => {
  const NEW_PLACE = { id: 42, name: "Home", lat: 10, lon: 20, radius: 50 };

  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.place.create as unknown as MockFn).mockResolvedValue(NEW_PLACE);
    (prisma.unknownVisitSuggestion.findMany as unknown as MockFn).mockResolvedValue([]);
  });

  it("transplants the superseded visit as a confirmed visit at the new place and deletes the original", async () => {
    const original = {
      id: 7,
      arrivalAt: new Date("2026-03-01T10:00:00Z"),
      departureAt: new Date("2026-03-01T11:00:00Z"),
      pointCount: 12,
    };
    (prisma.visit.findUnique as unknown as MockFn).mockResolvedValue(original);

    const res = await POST(
      makeRequest({ name: "Home", lat: 10, lon: 20, radius: 50, supersedesVisitId: 7 }),
    );

    expect(res.status).toBe(201);
    expect(prisma.visit.create).toHaveBeenCalledWith({
      data: {
        placeId: NEW_PLACE.id,
        arrivalAt: original.arrivalAt,
        departureAt: original.departureAt,
        status: "confirmed",
        pointCount: original.pointCount,
      },
    });
    expect(prisma.visit.delete).toHaveBeenCalledWith({ where: { id: 7 } });
  });

  it("leaves all visits alone when supersedesVisitId is not provided", async () => {
    await POST(
      makeRequest({ name: "Home", lat: 10, lon: 20, radius: 50 }),
    );

    expect(prisma.visit.findUnique).not.toHaveBeenCalled();
    expect(prisma.visit.create).not.toHaveBeenCalled();
    expect(prisma.visit.delete).not.toHaveBeenCalled();
  });

  it("does not invoke detectVisitsForPlace when creating a place without supersedesVisitId", async () => {
    await POST(
      makeRequest({ name: "Home", lat: 10, lon: 20, radius: 50 }),
    );

    expect(detectVisitsForPlace).not.toHaveBeenCalled();
  });

  it("does not include newVisits in the response body on plain creation", async () => {
    const res = await POST(
      makeRequest({ name: "Home", lat: 10, lon: 20, radius: 50 }),
    );
    const body = await res.json();

    expect(body).toEqual({ place: NEW_PLACE });
  });
});
