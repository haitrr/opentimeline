import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LayerToggleColumn from "@/components/map/LayerToggleColumn";
import type { LayerSettings } from "@/components/map/mapConstants";

function makeSettings(overrides: Partial<LayerSettings> = {}): LayerSettings {
  return {
    showHeatmap: false,
    setShowHeatmap: vi.fn(),
    showLine: true,
    setShowLine: vi.fn(),
    showVisitedPlaces: true,
    setShowVisitedPlaces: vi.fn(),
    hidePoints: false,
    setHidePoints: vi.fn(),
    hidePlaces: false,
    setHidePlaces: vi.fn(),
    hidePhotos: false,
    setHidePhotos: vi.fn(),
    settingsLoaded: true,
    ...overrides,
  };
}

describe("LayerToggleColumn", () => {
  it("renders a toggle for each of the six layers", () => {
    render(<LayerToggleColumn layerSettings={makeSettings()} />);
    for (const label of ["Heatmap", "Path line", "Visited places", "Points", "Places", "Photos"]) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    }
  });

  it("reflects the on/off state via aria-pressed", () => {
    render(
      <LayerToggleColumn
        layerSettings={makeSettings({
          showHeatmap: true,
          showLine: false,
          hidePlaces: true,
        })}
      />
    );
    expect(screen.getByRole("button", { name: "Heatmap" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Path line" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Places" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Points" })).toHaveAttribute("aria-pressed", "true");
  });

  it("toggles the layer setting when clicked", async () => {
    const setShowHeatmap = vi.fn();
    const setHidePlaces = vi.fn();
    const user = userEvent.setup();
    render(
      <LayerToggleColumn
        layerSettings={makeSettings({
          showHeatmap: false,
          setShowHeatmap,
          hidePlaces: false,
          setHidePlaces,
        })}
      />
    );
    await user.click(screen.getByRole("button", { name: "Heatmap" }));
    expect(setShowHeatmap).toHaveBeenCalledWith(true);

    await user.click(screen.getByRole("button", { name: "Places" }));
    expect(setHidePlaces).toHaveBeenCalledWith(true);
  });
});
