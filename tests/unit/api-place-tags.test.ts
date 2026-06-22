import { describe, it, expect, vi, beforeEach } from "vitest";

const mockTransaction = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: mockTransaction,
    tag: { upsert: vi.fn() },
    placeTag: { deleteMany: vi.fn(), createMany: vi.fn() },
    place: { findUnique: vi.fn() },
  },
}));

import { PUT } from "@/app/api/places/[id]/tags/route";
import { prisma } from "@/lib/prisma";

type MockFn = ReturnType<typeof vi.fn>;

function makeRequest(id: string, tags: string[]) {
  return {
    json: async () => ({ tags }),
    nextUrl: { pathname: `/api/places/${id}/tags` },
  } as unknown as import("next/server").NextRequest;
}

function makeParams(id: string) {
  return Promise.resolve({ id });
}

describe("PUT /api/places/:id/tags", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.place.findUnique as unknown as MockFn).mockResolvedValue({ id: 1 });
  });

  it("returns 404 when place does not exist", async () => {
    (prisma.place.findUnique as unknown as MockFn).mockResolvedValue(null);
    const res = await PUT(makeRequest("99", []), makeParams("99"));
    expect(res.status).toBe(404);
  });

  it("upserts tags and replaces PlaceTag rows atomically", async () => {
    const tagA = { id: 1, name: "coffee" };
    const tagB = { id: 2, name: "work" };

    mockTransaction.mockImplementation(async (fn: (tx: typeof prisma) => Promise<unknown>) => {
      const tx = {
        tag: {
          upsert: vi.fn()
            .mockResolvedValueOnce(tagA)
            .mockResolvedValueOnce(tagB),
        },
        placeTag: {
          deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
          createMany: vi.fn().mockResolvedValue({ count: 2 }),
        },
      };
      return fn(tx as unknown as typeof prisma);
    });

    const res = await PUT(makeRequest("1", ["Coffee", "work"]), makeParams("1"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ tags: ["coffee", "work"] });

    const txFn = mockTransaction.mock.calls[0][0];
    expect(typeof txFn).toBe("function");
  });

  it("normalizes tag names to lowercase", async () => {
    mockTransaction.mockImplementation(async (fn: (tx: typeof prisma) => Promise<unknown>) => {
      const tx = {
        tag: { upsert: vi.fn().mockResolvedValue({ id: 3, name: "café" }) },
        placeTag: {
          deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
          createMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
      };
      return fn(tx as unknown as typeof prisma);
    });

    const res = await PUT(makeRequest("1", ["CAFÉ"]), makeParams("1"));
    const body = await res.json();
    expect(body).toEqual({ tags: ["café"] });
  });

  it("handles empty tag list — removes all tags", async () => {
    mockTransaction.mockImplementation(async (fn: (tx: typeof prisma) => Promise<unknown>) => {
      const tx = {
        tag: { upsert: vi.fn() },
        placeTag: {
          deleteMany: vi.fn().mockResolvedValue({ count: 3 }),
          createMany: vi.fn().mockResolvedValue({ count: 0 }),
        },
      };
      return fn(tx as unknown as typeof prisma);
    });

    const res = await PUT(makeRequest("1", []), makeParams("1"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toEqual({ tags: [] });
  });
});
