import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    deviceFilter: {
      findMany: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

import { GET, POST } from "@/app/api/device-filters/route";
import { prisma } from "@/lib/prisma";

type MockFn = ReturnType<typeof vi.fn>;
const findMany = prisma.deviceFilter.findMany as unknown as MockFn;
const create = prisma.deviceFilter.create as unknown as MockFn;
const deleteFilter = prisma.deviceFilter.delete as unknown as MockFn;

const FILTER_RECORD = {
  id: "clxxx",
  fromTime: new Date("2026-04-01T08:00:00Z"),
  toTime: new Date("2026-04-01T18:00:00Z"),
  deviceIds: ["phone"],
  label: "Left tablet at home",
  createdAt: new Date("2026-04-19T10:00:00Z"),
};

describe("GET /api/device-filters", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns empty array when no filters", async () => {
    findMany.mockResolvedValueOnce([]);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it("serializes filter records to ISO strings", async () => {
    findMany.mockResolvedValueOnce([FILTER_RECORD]);
    const res = await GET();
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].fromTime).toBe("2026-04-01T08:00:00.000Z");
    expect(body[0].deviceIds).toEqual(["phone"]);
    expect(body[0].label).toBe("Left tablet at home");
  });
});

describe("POST /api/device-filters", () => {
  beforeEach(() => vi.clearAllMocks());

  function req(body: unknown) {
    return new Request("http://localhost/api/device-filters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("returns 400 when deviceIds missing", async () => {
    const res = await POST(req({ fromTime: "2026-04-01T08:00:00Z", toTime: "2026-04-01T18:00:00Z" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when deviceIds is empty", async () => {
    const res = await POST(req({ fromTime: "2026-04-01T08:00:00Z", toTime: "2026-04-01T18:00:00Z", deviceIds: [] }));
    expect(res.status).toBe(400);
  });

  it("creates and returns filter with 201", async () => {
    create.mockResolvedValueOnce(FILTER_RECORD);
    const res = await POST(req({ fromTime: "2026-04-01T08:00:00Z", toTime: "2026-04-01T18:00:00Z", deviceIds: ["phone"], label: "Left tablet at home" }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe("clxxx");
    expect(body.deviceIds).toEqual(["phone"]);
  });
});

describe("DELETE /api/device-filters/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 204 on success", async () => {
    deleteFilter.mockResolvedValueOnce(FILTER_RECORD);
    const { DELETE } = await import("@/app/api/device-filters/[id]/route");
    const res = await DELETE(new Request("http://localhost/"), {
      params: Promise.resolve({ id: "clxxx" }),
    });
    expect(res.status).toBe(204);
  });

  it("returns 404 when filter not found", async () => {
    deleteFilter.mockRejectedValueOnce(new Error("not found"));
    const { DELETE } = await import("@/app/api/device-filters/[id]/route");
    const res = await DELETE(new Request("http://localhost/"), {
      params: Promise.resolve({ id: "nonexistent" }),
    });
    expect(res.status).toBe(404);
  });
});
