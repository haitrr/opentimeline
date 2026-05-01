// tests/unit/time-range-slider.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TimeRangeSlider from "@/components/TimeRangeSlider";

vi.mock("@/components/ui/slider", () => ({
  Slider: ({
    onValueChange,
    value,
    min,
    max,
    step,
  }: {
    onValueChange: (v: number[]) => void;
    value: number[];
    min: number;
    max: number;
    step: number;
  }) => (
    <div
      data-testid="slider"
      data-value={value.join(",")}
      data-min={min}
      data-max={max}
      data-step={step}
      onClick={() => onValueChange([60, 600])}
    />
  ),
}));

const MIN = "2026-05-01T08:00:00.000Z"; // 08:00 UTC
const MAX = "2026-05-01T20:00:00.000Z"; // 720 minutes total

describe("TimeRangeSlider", () => {
  it("renders two thumb positions derived from value ISO strings", () => {
    const from = "2026-05-01T09:00:00.000Z"; // 60 min offset
    const to = "2026-05-01T18:00:00.000Z";   // 600 min offset
    render(
      <TimeRangeSlider min={MIN} max={MAX} value={[from, to]} onChange={vi.fn()} />
    );
    const slider = screen.getByTestId("slider");
    expect(slider.dataset.value).toBe("60,600");
    expect(slider.dataset.min).toBe("0");
    expect(slider.dataset.max).toBe("720");
    expect(slider.dataset.step).toBe("1");
  });

  it("calls onChange with ISO strings when slider emits new minute offsets", async () => {
    const onChange = vi.fn();
    render(
      <TimeRangeSlider min={MIN} max={MAX} value={[MIN, MAX]} onChange={onChange} />
    );
    await userEvent.click(screen.getByTestId("slider"));
    expect(onChange).toHaveBeenCalledOnce();
    const [from, to] = onChange.mock.calls[0];
    // 60 minutes after MIN → "2026-05-01T09:00:00.000Z"
    expect(from).toBe("2026-05-01T09:00:00.000Z");
    // 600 minutes after MIN → "2026-05-01T18:00:00.000Z"
    expect(to).toBe("2026-05-01T18:00:00.000Z");
  });

  it("passes step=1 to Slider for 1-minute snap", () => {
    render(
      <TimeRangeSlider min={MIN} max={MAX} value={[MIN, MAX]} onChange={vi.fn()} />
    );
    expect(screen.getByTestId("slider").dataset.step).toBe("1");
  });
});
