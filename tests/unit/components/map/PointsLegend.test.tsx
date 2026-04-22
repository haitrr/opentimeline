import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import PointsLegend from "@/components/map/PointsLegend";
import type { DeviceColor } from "@/lib/deviceColors";

function makeColors(entries: [string | null, DeviceColor][]): Map<string | null, DeviceColor> {
  return new Map(entries);
}

describe("PointsLegend", () => {
  it("renders nothing when hidePoints is true", () => {
    const { container } = render(
      <PointsLegend
        deviceColors={makeColors([["phone", { color: "#f97316", strokeColor: "#ea580c" }]])}
        hidePoints={true}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders a row for each device when visible", () => {
    render(
      <PointsLegend
        deviceColors={makeColors([
          ["phone", { color: "#f97316", strokeColor: "#ea580c" }],
          ["watch", { color: "#a855f7", strokeColor: "#9333ea" }],
        ])}
        hidePoints={false}
      />,
    );
    expect(screen.getByText("phone")).toBeInTheDocument();
    expect(screen.getByText("watch")).toBeInTheDocument();
  });

  it('labels null deviceId as "Unknown"', () => {
    render(
      <PointsLegend
        deviceColors={makeColors([[null, { color: "#3b82f6", strokeColor: "#1d4ed8" }]])}
        hidePoints={false}
      />,
    );
    expect(screen.getByText("Unknown")).toBeInTheDocument();
  });

  it("renders a color swatch with the device color", () => {
    render(
      <PointsLegend
        deviceColors={makeColors([["phone", { color: "#f97316", strokeColor: "#ea580c" }]])}
        hidePoints={false}
      />,
    );
    const swatch = document.querySelector('[data-testid="swatch-phone"]') as HTMLElement;
    expect(swatch).toBeTruthy();
    expect(swatch.style.backgroundColor).toBe("rgb(249, 115, 22)");
  });
});
