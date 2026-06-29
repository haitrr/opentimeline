import { test, expect } from "@playwright/test";

test("trips: create a trip manually and navigate to it from the activity bar and date picker", async ({ page }) => {
  await page.goto("/timeline");

  // Wait for app to hydrate
  await expect(page.getByRole("button", { name: "Timeline", exact: true })).toBeVisible({ timeout: 10000 });
  await page.waitForTimeout(1000);

  // Open the Trips tab via the activity bar
  const tripsBtn = page.locator('[aria-label="Trips"]:not([aria-pressed])');
  await tripsBtn.click();

  // Wait for TripsPanel to appear
  await expect(page.getByText("No trips yet").or(page.getByRole("button", { name: "New trip" }))).toBeVisible({ timeout: 5000 });

  // Click "New trip"
  await page.getByRole("button", { name: "New trip" }).click();

  // Fill in the form
  const nameInput = page.getByRole("textbox", { name: "Trip name" });
  await expect(nameInput).toBeVisible();
  await nameInput.fill("E2E Test Trip");

  const startInput = page.getByRole("textbox", { name: "Start date" }).or(page.locator('[aria-label="Start date"]'));
  const endInput = page.getByRole("textbox", { name: "End date" }).or(page.locator('[aria-label="End date"]'));
  await startInput.fill("2024-06-01");
  await endInput.fill("2024-06-05");

  // Submit
  await page.getByRole("button", { name: "Create" }).click();

  // Trip should appear in list
  await expect(page.getByText("E2E Test Trip")).toBeVisible({ timeout: 5000 });

  // Click the trip to navigate
  await page.getByText("E2E Test Trip").click();

  // URL should contain the trip's date range
  await expect(page).toHaveURL(/\/timeline\/2024-06-01\?range=custom&end=2024-06-05/, { timeout: 5000 });

  // Navigate back to the timeline today to test the DateNav quick-pick
  await page.goto("/timeline");
  await page.waitForTimeout(1000);

  // The trips section should appear in DateNav (inside the Timeline tab)
  await expect(page.getByRole("button", { name: "Timeline" })).toBeVisible();

  // The trip name should appear in DateNav as a quick-pick
  await expect(page.getByText("E2E Test Trip")).toBeVisible({ timeout: 5000 });

  // Click the quick-pick
  await page.getByText("E2E Test Trip").click();
  await expect(page).toHaveURL(/\/timeline\/2024-06-01\?range=custom&end=2024-06-05/, { timeout: 5000 });

  // Clean up: go back to trips tab and delete the trip
  await page.goto("/timeline");
  await page.waitForTimeout(1000);
  const tripsBtn2 = page.locator('[aria-label="Trips"]:not([aria-pressed])');
  await tripsBtn2.click();

  await expect(page.getByText("E2E Test Trip")).toBeVisible({ timeout: 5000 });
  const tripCard = page.locator("div").filter({ hasText: "E2E Test Trip" }).first();
  await tripCard.hover();

  // Register dialog handler before the click that triggers it
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete trip" }).click();

  // Trip should be gone
  await expect(page.getByText("E2E Test Trip")).not.toBeVisible({ timeout: 5000 });
});
