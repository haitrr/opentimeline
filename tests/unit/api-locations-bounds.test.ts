import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { $queryRaw: vi.fn() },
}));

import { GET } from "@/app/api/locations/bounds/route";
import { prisma } from "@/lib/prisma";

type MockFn = ReturnType<typeof vi.fn>;
const queryRaw = prisma.$queryRaw as unknown as MockFn;

function req(params: Record<string, string>) {
  const usp = new URLSearchParams(params);
  return new Request(`http://localhost/api/locations/bounds?${usp.toString()}`);
}

const WINDOW = {
  start: "2026-04-12T00:00:00.000Z",
  end: "2026-04-12T23:59:59.999Z",
};

describe("GET /api/locations/bounds", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when start or end is missing", async () => {
    const res = await GET(req({ start: WINDOW.start }));
    expect(res.status).toBe(400);
  });

  it("returns 400 on invalid dates", async () => {
    const res = await GET(req({ start: "nope", end: WINDOW.end }));
    expect(res.status).toBe(400);
  });

  it("returns the bounding box over the window", async () => {
    queryRaw.mockResolvedValue([
      { minLat: 10.1, maxLat: 11.2, minLon: 30.5, maxLon: 31.9 },
    ]);

    const res = await GET(req(WINDOW));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ minLat: 10.1, maxLat: 11.2, minLon: 30.5, maxLon: 31.9 });
  });

  it("returns 404 when no points fall in the window", async () => {
    queryRaw.mockResolvedValue([
      { minLat: null, maxLat: null, minLon: null, maxLon: null },
    ]);
    const res = await GET(req(WINDOW));
    expect(res.status).toBe(404);
  });
});
