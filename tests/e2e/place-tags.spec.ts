import { test, expect } from "@playwright/test";

test("place tags: add a tag from the list and search by it", async ({ page }) => {
  await page.goto("/timeline");

  // Wait for the app to finish hydrating — the activity bar is present
  const timelineBtn = page.getByRole("button", { name: "Timeline", exact: true });
  await expect(timelineBtn).toBeVisible({ timeout: 10000 });

  // Give map layer controls time to render (they load asynchronously)
  await page.waitForTimeout(2000);

  const search = page.getByRole("combobox", { name: "Search places" });
  const emptyState = page.getByText("No places yet");

  // Open the Places panel via the activity bar button (not the map layer toggle)
  // The activity bar button lacks aria-pressed; the map layer button has aria-pressed="true"
  const placesActivityBtn = page.locator('[aria-label="Places"]:not([aria-pressed])');
  await placesActivityBtn.click();

  // Wait for either the empty state or the search input to appear
  await expect(emptyState.or(search)).toBeVisible({ timeout: 10000 });

  if (await emptyState.isVisible()) {
    test.skip();
    return;
  }

  await expect(search).toBeVisible();

  // Hover first row to reveal action area, then click the tag button
  const firstRow = page.locator('ul li div[role="button"]').first();
  await firstRow.hover();

  // Click the "Edit tags" / tag button to open the popover
  const tagButton = page.getByRole("button", { name: /edit tags|tag/i }).first();
  await tagButton.click();

  // Type a unique tag name
  const tagInput = page.getByRole("textbox", { name: "Add tag" });
  await expect(tagInput).toBeVisible();
  await tagInput.fill("e2etest-tag");
  await tagInput.press("Enter");

  // The tag pill should appear inside the popover
  await expect(page.getByText("e2etest-tag").first()).toBeVisible({ timeout: 5000 });

  // Close the popover by pressing Escape
  await page.keyboard.press("Escape");

  // Search by the tag name
  await search.fill("e2etest-tag");

  // The place with that tag should appear in results
  await expect(page.locator('ul li').first()).toBeVisible({ timeout: 3000 });

  // Clean up: reopen tag editor and remove the tag
  const firstRowAfterSearch = page.locator('ul li div[role="button"]').first();
  await firstRowAfterSearch.hover();
  const tagButtonAfter = page.getByRole("button", { name: /edit tags|tag/i }).first();
  await tagButtonAfter.click();
  const removeButton = page.getByRole("button", { name: /remove e2etest-tag/i });
  await expect(removeButton).toBeVisible({ timeout: 3000 });
  await removeButton.click();

  // Close the popover after removing
  await page.keyboard.press("Escape");

  // Clear the search so the tag pill in the list item becomes the relevant reference
  await search.clear();

  // Wait for the tag pill to disappear from the list (tag removed from place)
  await expect(page.locator('ul li').first().getByText("e2etest-tag")).not.toBeVisible({ timeout: 5000 });
});
