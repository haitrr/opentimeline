import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    tag: { findMany: vi.fn() },
  },
}));

import { GET } from "@/app/api/tags/route";
import { prisma } from "@/lib/prisma";

type MockFn = ReturnType<typeof vi.fn>;

function makeRequest(q?: string) {
  const url = q ? `http://localhost/api/tags?q=${encodeURIComponent(q)}` : "http://localhost/api/tags";
  return new Request(url) as unknown as import("next/server").NextRequest;
}

describe("GET /api/tags", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns matching tag names ordered by usage count", async () => {
    (prisma.tag.findMany as unknown as MockFn).mockResolvedValue([
      { name: "coffee", _count: { places: 5 } },
      { name: "cafe", _count: { places: 2 } },
    ]);

    const res = await GET(makeRequest("c"));
    const body = await res.json();

    expect(body).toEqual({ tags: ["coffee", "cafe"] });
    expect(prisma.tag.findMany).toHaveBeenCalledWith({
      where: { name: { contains: "c", mode: "insensitive" } },
      orderBy: { places: { _count: "desc" } },
      take: 10,
      select: { name: true },
    });
  });

  it("returns all tags when q is empty", async () => {
    (prisma.tag.findMany as unknown as MockFn).mockResolvedValue([
      { name: "work" },
      { name: "home" },
    ]);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(body).toEqual({ tags: ["work", "home"] });
    expect(prisma.tag.findMany).toHaveBeenCalledWith({
      where: {},
      orderBy: { places: { _count: "desc" } },
      take: 10,
      select: { name: true },
    });
  });

  it("returns empty array when no tags match", async () => {
    (prisma.tag.findMany as unknown as MockFn).mockResolvedValue([]);
    const res = await GET(makeRequest("zzz"));
    const body = await res.json();
    expect(body).toEqual({ tags: [] });
  });
});
