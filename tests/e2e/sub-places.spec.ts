import { test, expect } from "@playwright/test";

test.describe("Sub-places", () => {
  test("can add a sub-place to a parent place via the detail modal", async ({ page }) => {
    await page.goto("/");

    // Open Places panel
    await page.getByRole("button", { name: /places/i }).first().click();

    // Wait for places to load and click the first one (scope to list items to avoid nav buttons)
    const firstPlaceItem = page.locator('li [role="button"][aria-label]').first();
    await firstPlaceItem.waitFor({ state: "visible", timeout: 10000 });
    await firstPlaceItem.click();

    // Wait for the modal
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });

    // Scroll to and find the "Places inside" section
    const placesInsideHeading = page.getByRole("heading", { name: /places inside/i });
    await placesInsideHeading.scrollIntoViewIfNeeded();
    await expect(placesInsideHeading).toBeVisible();

    // Click the "Add" button in that section
    const addButton = page.locator('[role="dialog"]').getByRole("button", { name: /^add$/i }).last();
    await addButton.click();

    // Type a sub-place name
    const nameInput = page.getByPlaceholder(/sub-place name/i);
    await expect(nameInput).toBeVisible();
    await nameInput.fill("H&M");

    // Submit
    await page.locator('[role="dialog"]').getByRole("button", { name: /^add$/i }).last().click();

    // The sub-place should appear in the "Places inside" section list
    const placesInsideSection = page.locator('[role="dialog"]').filter({ hasText: /places inside/i }).last();
    await expect(placesInsideSection.getByText("H&M").first()).toBeVisible({ timeout: 5000 });
  });

  test("Places panel shows expand toggle for places with children", async ({ page }) => {
    await page.goto("/");

    // Open Places panel
    await page.getByRole("button", { name: /places/i }).first().click();

    // Check if any expand toggle exists (only present when there are sub-places)
    const expandBtn = page.locator('button[aria-label="Expand sub-places"]').first();
    const count = await expandBtn.count();

    if (count > 0) {
      await expandBtn.click();
      await expect(page.locator('button[aria-label="Collapse sub-places"]').first()).toBeVisible();

      // Click again to collapse
      await page.locator('button[aria-label="Collapse sub-places"]').first().click();
      await expect(page.locator('button[aria-label="Expand sub-places"]').first()).toBeVisible();
    } else {
      // No parent places yet — test passes vacuously
      test.info().annotations.push({ type: "note", description: "No parent places found; expand toggle test skipped" });
    }
  });

  test("sub-place visit annotation panel appears on visits to parent places", async ({ page }) => {
    await page.goto("/");

    // Open Places panel and find a place with sub-places (has expand toggle)
    await page.getByRole("button", { name: /places/i }).first().click();

    const expandBtn = page.locator('button[aria-label="Expand sub-places"]').first();
    const count = await expandBtn.count();

    if (count === 0) {
      test.info().annotations.push({ type: "note", description: "No parent places found; annotation panel test skipped" });
      return;
    }

    // Click the parent place to open detail modal
    const parentPlaceRow = expandBtn.locator("..").locator("..").locator('[role="button"]').first();
    await parentPlaceRow.click();

    // Wait for the modal
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });

    // If there are confirmed visits, the "Places visited inside" label should appear
    const annotation = page.locator('[role="dialog"]').getByText(/places visited inside/i);
    if (await annotation.count() > 0) {
      await expect(annotation.first()).toBeVisible();
    }
  });
});
