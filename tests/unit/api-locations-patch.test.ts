import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    locationPoint: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { PATCH } from "@/app/api/locations/[id]/route";
import { prisma } from "@/lib/prisma";

type MockFn = ReturnType<typeof vi.fn>;
const findUnique = prisma.locationPoint.findUnique as unknown as MockFn;
const update = prisma.locationPoint.update as unknown as MockFn;

const EXISTING = {
  id: 1, lat: 48.8, lon: 2.3, tst: 1000,
  recordedAt: new Date(), acc: null, batt: null, tid: null, alt: null, vel: null,
};

function req(id: string, body: object) {
  return new Request(`http://localhost/api/locations/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("PATCH /api/locations/[id]", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("returns 400 for non-numeric id", async () => {
    const res = await PATCH(req("abc", { lat: 1, lon: 1 }), ctx("abc"));
    expect(res.status).toBe(400);
  });

  it("returns 404 when location not found", async () => {
    findUnique.mockResolvedValue(null);
    const res = await PATCH(req("99", { lat: 1, lon: 1 }), ctx("99"));
    expect(res.status).toBe(404);
  });

  it("returns 400 for lat out of range", async () => {
    findUnique.mockResolvedValue(EXISTING);
    const res = await PATCH(req("1", { lat: 91, lon: 0 }), ctx("1"));
    expect(res.status).toBe(400);
  });

  it("returns 400 for lon out of range", async () => {
    findUnique.mockResolvedValue(EXISTING);
    const res = await PATCH(req("1", { lat: 0, lon: 181 }), ctx("1"));
    expect(res.status).toBe(400);
  });

  it("returns 400 for non-numeric lat", async () => {
    findUnique.mockResolvedValue(EXISTING);
    const res = await PATCH(req("1", { lat: "bad", lon: 0 }), ctx("1"));
    expect(res.status).toBe(400);
  });

  it("updates location coordinates and returns 200", async () => {
    findUnique.mockResolvedValue(EXISTING);
    const updated = { ...EXISTING, lat: 48.9, lon: 2.4 };
    update.mockResolvedValue(updated);

    const res = await PATCH(req("1", { lat: 48.9, lon: 2.4 }), ctx("1"));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.lat).toBe(48.9);
    expect(body.lon).toBe(2.4);
    expect(update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { lat: 48.9, lon: 2.4 },
    });
  });
});
