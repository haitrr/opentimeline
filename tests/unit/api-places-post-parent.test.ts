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

describe("POST /api/places — parentId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.unknownVisitSuggestion.findMany as MockFn).mockResolvedValue([]);
    (prisma.visit.findMany as MockFn).mockResolvedValue([]);
  });

  it("creates a sub-place with parentId", async () => {
    const CHILD = { id: 99, name: "H&M", lat: 10, lon: 20, radius: 200, parentId: 3 };
    (prisma.place.create as MockFn).mockResolvedValue(CHILD);

    const res = await POST(makeRequest({ name: "H&M", lat: 10, lon: 20, parentId: 3 }));

    expect(res.status).toBe(201);
    expect(prisma.place.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ name: "H&M", parentId: 3 }),
      })
    );
  });

  it("does not trigger visit detection for sub-places", async () => {
    const CHILD = { id: 99, name: "H&M", lat: 10, lon: 20, radius: 200, parentId: 3 };
    (prisma.place.create as MockFn).mockResolvedValue(CHILD);

    await POST(makeRequest({ name: "H&M", lat: 10, lon: 20, parentId: 3 }));

    expect(detectVisitsForPlace).not.toHaveBeenCalled();
  });

  it("does not dismiss unknown visit suggestions for sub-places", async () => {
    const CHILD = { id: 99, name: "H&M", lat: 10, lon: 20, radius: 200, parentId: 3 };
    (prisma.place.create as MockFn).mockResolvedValue(CHILD);

    await POST(makeRequest({ name: "H&M", lat: 10, lon: 20, parentId: 3 }));

    expect(prisma.unknownVisitSuggestion.findMany).not.toHaveBeenCalled();
  });
});
