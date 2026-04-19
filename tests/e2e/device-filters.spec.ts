import { test, expect } from "@playwright/test";

test("device filter CRUD via API", async ({ request }) => {
  // Create a filter
  const create = await request.post("/api/device-filters", {
    data: {
      fromTime: "2026-04-01T08:00:00Z",
      toTime: "2026-04-01T18:00:00Z",
      deviceIds: ["phone"],
      label: "Test filter",
    },
  });
  expect(create.status()).toBe(201);
  const { id } = await create.json();
  expect(typeof id).toBe("string");

  // List — should include new filter
  const list = await request.get("/api/device-filters");
  expect(list.status()).toBe(200);
  const filters = await list.json();
  expect(filters.some((f: { id: string }) => f.id === id)).toBe(true);

  // Delete
  const del = await request.delete(`/api/device-filters/${id}`);
  expect(del.status()).toBe(204);

  // List — should no longer include it
  const listAfter = await request.get("/api/device-filters");
  const filtersAfter = await listAfter.json();
  expect(filtersAfter.some((f: { id: string }) => f.id === id)).toBe(false);
});
