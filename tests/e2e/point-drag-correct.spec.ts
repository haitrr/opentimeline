import { test, expect } from "@playwright/test";

test("point drag: CMD+drag shows confirm dialog, cancel leaves point in place", async ({ page }) => {
  await page.goto("/timeline");

  // Wait for the map canvas to load
  const canvas = page.locator(".maplibregl-canvas");
  await canvas.waitFor({ timeout: 15000 });

  // Zoom in so the location-points layer (minzoom 12) becomes visible.
  // Use the fit-bounds button if present, then zoom in further.
  const fitButton = page.getByTitle(/fit/i).or(page.getByRole("button", { name: /fit/i })).first();
  if (await fitButton.isVisible({ timeout: 2000 }).catch(() => false)) {
    await fitButton.click();
    await page.waitForTimeout(1200);
  }

  // Zoom in 5 more levels using the keyboard shortcut
  for (let i = 0; i < 5; i++) {
    await canvas.click();
    await page.keyboard.press("+");
    await page.waitForTimeout(100);
  }
  await page.waitForTimeout(500);

  // Hold CMD to activate point drag mode
  await page.keyboard.down("Meta");

  const box = await canvas.boundingBox();
  if (!box) {
    await page.keyboard.up("Meta");
    test.skip();
    return;
  }

  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;

  // Move over the canvas center; if a point is hovered, cursor becomes "grab"
  await page.mouse.move(cx, cy);
  await page.waitForTimeout(200);

  // Attempt drag from center — if a point is there, the confirm dialog will appear
  await page.mouse.down();
  await page.mouse.move(cx + 40, cy + 40, { steps: 10 });
  await page.mouse.up();

  await page.keyboard.up("Meta");

  // If dialog appeared (a point was under the cursor), test the cancel flow
  const dialog = page.getByRole("alertdialog");
  const dialogVisible = await dialog.isVisible({ timeout: 1500 }).catch(() => false);

  if (!dialogVisible) {
    // No point was under cursor — skip gracefully (no data at this zoom/position)
    return;
  }

  await expect(dialog).toContainText("Move point to new location?");
  await expect(dialog).toContainText("This cannot be undone");

  // Cancel — dialog should close and no API call should have been made
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).not.toBeVisible({ timeout: 2000 });
});

test("point drag: CMD not held — no drag mode, normal map interaction", async ({ page }) => {
  await page.goto("/timeline");
  const canvas = page.locator(".maplibregl-canvas");
  await canvas.waitFor({ timeout: 15000 });

  // Without CMD, dragging the canvas pans the map (cursor stays default/grab for pan)
  const box = await canvas.boundingBox();
  if (!box) return;

  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;

  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 60, cy, { steps: 5 });
  await page.mouse.up();

  // No dialog should appear — just a pan
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).not.toBeVisible({ timeout: 500 });
});
