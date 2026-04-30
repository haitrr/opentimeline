import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    place: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/lib/detectVisits", () => ({
  detectVisitsForPlace: vi.fn(),
}));

import { POST } from "@/app/api/places/[id]/detect-visits/route";
import { prisma } from "@/lib/prisma";
import { detectVisitsForPlace } from "@/lib/detectVisits";

type MockFn = ReturnType<typeof vi.fn>;

function makeParams(id: string) {
  return {
    params: Promise.resolve({ id }),
  } as Parameters<typeof POST>[1];
}

describe("POST /api/places/[id]/detect-visits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 for a non-numeric id", async () => {
    const res = await POST(new Request("http://localhost"), makeParams("abc"));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid id");
  });

  it("returns 404 when the place does not exist", async () => {
    (prisma.place.findUnique as MockFn).mockResolvedValue(null);
    const res = await POST(new Request("http://localhost"), makeParams("99"));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Not found");
  });

  it("calls detectVisitsForPlace and returns newVisits count", async () => {
    (prisma.place.findUnique as MockFn).mockResolvedValue({ id: 1 });
    (detectVisitsForPlace as MockFn).mockResolvedValue(3);
    const res = await POST(new Request("http://localhost"), makeParams("1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ newVisits: 3 });
    expect(detectVisitsForPlace).toHaveBeenCalledWith(1);
  });
});
