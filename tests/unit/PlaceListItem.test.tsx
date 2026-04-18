import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import PlaceListItem, { type PlacePanelItem } from "@/components/places/PlaceListItem";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const BASE: PlacePanelItem = {
  id: 1,
  name: "Home",
  lat: 10.77,
  lon: 106.7,
  radius: 50,
  isActive: true,
  totalVisits: 128,
  confirmedVisits: 128,
  visitsInRange: 128,
  confirmedVisitsInRange: 128,
  suggestedVisitsInRange: 0,
  lastVisitAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
  createdAt: new Date("2025-01-01").toISOString(),
};

describe("PlaceListItem", () => {
  let flyHandler: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    flyHandler = vi.fn();
    window.addEventListener("opentimeline:fly-to", flyHandler as EventListener);
  });

  afterEach(() => {
    window.removeEventListener("opentimeline:fly-to", flyHandler as EventListener);
    vi.restoreAllMocks();
  });

  const noop = () => {};

  it("renders name, visits count, radius, and relative time", () => {
    render(<PlaceListItem place={BASE} onEdit={noop} onDelete={noop} />);
    expect(screen.getByText("Home")).toBeInTheDocument();
    expect(screen.getByText(/128 visits/)).toBeInTheDocument();
    expect(screen.getByText(/50m radius/)).toBeInTheDocument();
    expect(screen.getByText(/2d ago/)).toBeInTheDocument();
  });

  it("pluralizes '1 visit' vs multiple visits", () => {
    const single = { ...BASE, confirmedVisits: 1 };
    const { rerender } = render(<PlaceListItem place={single} onEdit={noop} onDelete={noop} />);
    expect(screen.getByText(/1 visit · 50m radius/)).toBeInTheDocument();

    rerender(<PlaceListItem place={{ ...BASE, confirmedVisits: 2 }} onEdit={noop} onDelete={noop} />);
    expect(screen.getByText(/2 visits · 50m radius/)).toBeInTheDocument();
  });

  it("shows 'No visits yet' when confirmedVisits is 0 and hides the last-visit line", () => {
    const never = { ...BASE, confirmedVisits: 0, lastVisitAt: null };
    render(<PlaceListItem place={never} onEdit={noop} onDelete={noop} />);
    expect(screen.getByText(/No visits yet/)).toBeInTheDocument();
    expect(screen.queryByText(/ago|Never|Yesterday/)).not.toBeInTheDocument();
  });

  it("dispatches opentimeline:fly-to when the row is clicked", async () => {
    const user = userEvent.setup();
    render(<PlaceListItem place={BASE} onEdit={noop} onDelete={noop} />);
    await user.click(screen.getByRole("button", { name: "Home" }));
    expect(flyHandler).toHaveBeenCalledTimes(1);
    const detail = (flyHandler.mock.calls[0][0] as CustomEvent).detail;
    expect(detail).toEqual({ lat: BASE.lat, lon: BASE.lon });
  });

  it("dispatches fly-to on Enter key", () => {
    render(<PlaceListItem place={BASE} onEdit={noop} onDelete={noop} />);
    const row = screen.getByRole("button", { name: "Home" });
    fireEvent.keyDown(row, { key: "Enter" });
    expect(flyHandler).toHaveBeenCalledTimes(1);
  });

  it("dispatches fly-to on Space key", () => {
    render(<PlaceListItem place={BASE} onEdit={noop} onDelete={noop} />);
    const row = screen.getByRole("button", { name: "Home" });
    fireEvent.keyDown(row, { key: " " });
    expect(flyHandler).toHaveBeenCalledTimes(1);
  });

  it("edit button calls onEdit and does NOT dispatch fly-to", async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    render(<PlaceListItem place={BASE} onEdit={onEdit} onDelete={noop} />);
    await user.click(screen.getByRole("button", { name: /edit place/i }));
    expect(onEdit).toHaveBeenCalledWith(BASE);
    expect(flyHandler).not.toHaveBeenCalled();
  });

  it("copy-coords writes to clipboard and shows a success toast", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    render(<PlaceListItem place={BASE} onEdit={noop} onDelete={noop} />);
    await user.click(screen.getByRole("button", { name: /copy coordinates/i }));
    expect(writeText).toHaveBeenCalledWith(`${BASE.lat}, ${BASE.lon}`);
    expect(toast.success).toHaveBeenCalledWith("Coordinates copied");
    expect(flyHandler).not.toHaveBeenCalled();
  });

  it("delete button calls onDelete only after window.confirm", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<PlaceListItem place={BASE} onEdit={noop} onDelete={onDelete} />);
    await user.click(screen.getByRole("button", { name: /delete place/i }));
    expect(confirmSpy).toHaveBeenCalled();
    expect(onDelete).toHaveBeenCalledWith(BASE);
    expect(flyHandler).not.toHaveBeenCalled();
  });

  it("delete button does NOT call onDelete when confirm is cancelled", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<PlaceListItem place={BASE} onEdit={noop} onDelete={onDelete} />);
    await user.click(screen.getByRole("button", { name: /delete place/i }));
    expect(onDelete).not.toHaveBeenCalled();
  });

  it("renders confirmedVisits in the stats, not totalVisits", () => {
    render(
      <PlaceListItem
        place={{ ...BASE, totalVisits: 500, confirmedVisits: 42 }}
        onEdit={noop}
        onDelete={noop}
      />
    );
    expect(screen.getByText(/42 visits/)).toBeInTheDocument();
    expect(screen.queryByText(/500 visits/)).not.toBeInTheDocument();
  });

  it("surfaces clipboard failures via a toast instead of throwing", async () => {
    const user = userEvent.setup();
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: () => Promise.reject(new Error("denied")) },
    });
    render(<PlaceListItem place={BASE} onEdit={noop} onDelete={noop} />);
    await expect(
      user.click(screen.getByRole("button", { name: /copy coordinates/i }))
    ).resolves.not.toThrow();
  });
});
