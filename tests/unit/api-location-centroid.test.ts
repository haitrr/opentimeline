import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { $queryRaw: vi.fn() },
}));

import { GET } from "@/app/api/location-centroid/route";
import { prisma } from "@/lib/prisma";

type MockFn = ReturnType<typeof vi.fn>;
const queryRaw = prisma.$queryRaw as unknown as MockFn;

function req(params: Record<string, string>) {
  const usp = new URLSearchParams(params);
  return new Request(`http://localhost/api/location-centroid?${usp.toString()}`);
}

describe("GET /api/location-centroid", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when start or end are missing", async () => {
    const res = await GET(req({ start: "2026-04-12T00:00:00Z" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 on invalid dates", async () => {
    const res = await GET(req({ start: "nope", end: "2026-04-12T01:00:00Z" }));
    expect(res.status).toBe(400);
  });

  it("returns averaged lat/lon over the window", async () => {
    queryRaw.mockResolvedValue([{ lat: 10.5, lon: 20.5 }]);
    const res = await GET(req({
      start: "2026-04-12T09:00:00Z",
      end: "2026-04-12T10:00:00Z",
    }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toEqual({ lat: 10.5, lon: 20.5 });
  });

  it("returns 404 when no points fall in the window", async () => {
    queryRaw.mockResolvedValue([{ lat: null, lon: null }]);
    const res = await GET(req({
      start: "2026-04-12T09:00:00Z",
      end: "2026-04-12T10:00:00Z",
    }));
    expect(res.status).toBe(404);
  });
});
