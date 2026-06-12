import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    place: { findMany: vi.fn() },
    locationPoint: { findMany: vi.fn() },
    deviceFilter: { findMany: vi.fn() },
    visit: {
      findMany: vi.fn(),
      createMany: vi.fn(),
      deleteMany: vi.fn(),
      updateMany: vi.fn(),
    },
    appSettings: { findUnique: vi.fn() },
  },
}));

import { detectVisitsForAllPlaces } from "@/lib/detectVisits";
import { prisma } from "@/lib/prisma";

type MockFn = ReturnType<typeof vi.fn>;

describe("detectVisitsForAllPlaces - sub-place exclusion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.place.findMany as MockFn).mockResolvedValue([]);
    (prisma.locationPoint.findMany as MockFn).mockResolvedValue([]);
    (prisma.deviceFilter.findMany as MockFn).mockResolvedValue([]);
    (prisma.appSettings.findUnique as MockFn).mockResolvedValue(null);
  });

  it("queries only root places (parentId: null) when loading places for detection", async () => {
    await detectVisitsForAllPlaces();
    expect(prisma.place.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ parentId: null }),
      })
    );
  });
});
