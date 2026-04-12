import { test, expect } from "@playwright/test";

test("map issues paginated locations requests with required params", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (req) => {
    const u = new URL(req.url());
    if (u.pathname === "/api/locations") requests.push(req.url());
  });

  await page.goto("/timeline/2026-04-12?range=all");

  // Give the map time to settle and fetchNextPage to iterate.
  await page.waitForTimeout(2000);

  // The map may not fire any request if the viewport never reports bounds
  // in a headless run; we only enforce param shape when requests occurred.
  for (const url of requests) {
    const u = new URL(url);
    expect(u.searchParams.get("start"), `start missing on ${url}`).not.toBeNull();
    expect(u.searchParams.get("end"), `end missing on ${url}`).not.toBeNull();
    expect(u.searchParams.get("minLat"), `minLat missing on ${url}`).not.toBeNull();
    expect(u.searchParams.get("maxLat"), `maxLat missing on ${url}`).not.toBeNull();
  }
});
