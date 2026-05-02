// tests/unit/create-filter-dialog.test.tsx
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import CreateFilterDialog from "@/components/CreateFilterDialog";
import type { ReactNode } from "react";

vi.mock("@/components/FilterPreviewMap", () => ({
  default: () => <div data-testid="filter-preview-map" />,
}));

vi.mock("@/components/TimeRangeSlider", () => ({
  default: ({
    value,
    onChange,
  }: {
    value: [string, string];
    onChange: (f: string, t: string) => void;
  }) => (
    <div
      data-testid="time-range-slider"
      onClick={() => onChange(value[0], value[1])}
    />
  ),
}));

const mockCreateFilter = vi.fn();
vi.mock("@/components/DeviceFilterProvider", () => ({
  useDeviceFilters: () => ({ createFilter: mockCreateFilter }),
}));

const RANGE_START = "2026-05-01T08:00:00.000Z";
const RANGE_END = "2026-05-01T20:00:00.000Z";

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

describe("CreateFilterDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ points: [] }),
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("populates device list from fetched location data", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            points: [
              {
                id: 1, lat: 1, lon: 1, tst: 1, recordedAt: RANGE_START,
                acc: null, batt: null, tid: null, alt: null, vel: null,
                deviceId: "phone",
              },
              {
                id: 2, lat: 2, lon: 2, tst: 2, recordedAt: RANGE_START,
                acc: null, batt: null, tid: null, alt: null, vel: null,
                deviceId: "tablet",
              },
            ],
          }),
      }),
    );

    render(
      <CreateFilterDialog rangeStart={RANGE_START} rangeEnd={RANGE_END} onClose={vi.fn()} />,
      { wrapper: makeWrapper() },
    );

    await waitFor(() => {
      expect(screen.getByText("phone")).toBeInTheDocument();
      expect(screen.getByText("tablet")).toBeInTheDocument();
    });
  });

  it("disables Save when no devices are available", async () => {
    render(
      <CreateFilterDialog rangeStart={RANGE_START} rangeEnd={RANGE_END} onClose={vi.fn()} />,
      { wrapper: makeWrapper() },
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Save filter" })).toBeDisabled();
    });
  });

  it("calls createFilter with correct args and invokes onClose on save", async () => {
    mockCreateFilter.mockResolvedValue(undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            points: [
              {
                id: 1, lat: 1, lon: 1, tst: 1, recordedAt: RANGE_START,
                acc: null, batt: null, tid: null, alt: null, vel: null,
                deviceId: "phone",
              },
            ],
          }),
      }),
    );

    const onClose = vi.fn();
    render(
      <CreateFilterDialog rangeStart={RANGE_START} rangeEnd={RANGE_END} onClose={onClose} />,
      { wrapper: makeWrapper() },
    );

    await waitFor(() => expect(screen.getByText("phone")).toBeInTheDocument());

    await userEvent.type(
      screen.getByPlaceholderText("e.g. Left phone at home"),
      "Test label",
    );
    await userEvent.click(screen.getByRole("button", { name: "Save filter" }));

    await waitFor(() => {
      expect(mockCreateFilter).toHaveBeenCalledWith({
        fromTime: RANGE_START,
        toTime: RANGE_END,
        deviceIds: ["phone"],
        label: "Test label",
      });
      expect(onClose).toHaveBeenCalled();
    });
  });
});
