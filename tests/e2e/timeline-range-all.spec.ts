import { test, expect } from "@playwright/test";

test("timeline loads with range=all without server error", async ({ page }) => {
  const resp = await page.goto("/timeline/2026-04-12?range=all");
  expect(resp?.status()).toBeLessThan(500);

  // Stats tile renders (Distance/Points/Days)
  await expect(page.getByText("Distance")).toBeVisible();
  await expect(page.getByText("Points")).toBeVisible();
});
