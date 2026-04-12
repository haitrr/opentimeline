import { test, expect } from "@playwright/test";

test("map issues paginated locations requests with required params", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (req) => {
    if (req.url().includes("/api/locations")) requests.push(req.url());
  });

  await page.goto("/timeline/2026-04-12?range=all");

  // Give the map time to settle and fetchNextPage to iterate.
  await page.waitForTimeout(2000);

  // Either decimated (1 request with decimated:true) or paginated (>=1).
  expect(requests.length).toBeGreaterThanOrEqual(1);

  // Every request must carry the new required params.
  for (const url of requests) {
    const u = new URL(url);
    expect(u.searchParams.get("start")).not.toBeNull();
    expect(u.searchParams.get("end")).not.toBeNull();
    expect(u.searchParams.get("minLat")).not.toBeNull();
    expect(u.searchParams.get("maxLat")).not.toBeNull();
  }
});
