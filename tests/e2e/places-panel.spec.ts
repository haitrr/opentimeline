import { test, expect } from "@playwright/test";

// The Places tab is toggled via the sidebar activity bar button (aria-label="Places").
// If the app has no seeded places the empty state renders — we assert that and return.
// Otherwise we exercise search + row-click fly-to.

test("places panel: empty state OR search and row click dispatches fly-to", async ({ page }) => {
  await page.goto("/timeline");

  // Open the Places tab.
  await page.getByRole("button", { name: "Places" }).first().click();

  const emptyState = page.getByText("No places yet");
  const search = page.getByLabel("Search places");

  if (await emptyState.isVisible({ timeout: 2000 }).catch(() => false)) {
    await expect(emptyState).toBeVisible();
    return;
  }

  await expect(search).toBeVisible();

  // Attach a listener to capture the fly-to event.
  await page.evaluate(() => {
    (window as Window & { __flyTo?: unknown }).__flyTo = null;
    window.addEventListener("opentimeline:fly-to", (e) => {
      (window as Window & { __flyTo?: unknown }).__flyTo = (e as CustomEvent).detail;
    });
  });

  // Click the first row inside the panel (skip the activity-bar buttons and search/sort).
  // PlaceListItem is a div with role="button" and aria-label equal to the place name.
  const firstRow = page.locator('ul li div[role="button"]').first();
  await firstRow.click();

  const detail = await page.evaluate(
    () => (window as Window & { __flyTo?: { lat: number; lon: number } }).__flyTo
  );
  expect(detail).toMatchObject({
    lat: expect.any(Number),
    lon: expect.any(Number),
  });
});
