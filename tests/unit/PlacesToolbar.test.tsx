import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import PlacesToolbar, { type PlacesSort } from "@/components/places/PlacesToolbar";

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe("PlacesToolbar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ tags: [] }),
    } as unknown as Response);
  });

  const noop = () => {};

  const defaultProps = {
    sort: "recent" as PlacesSort,
    onSortChange: noop,
    tagFilter: null as string | null,
    onTagFilterChange: noop,
    count: 3,
  };

  it("shows the sort label (not the raw value) in the trigger", () => {
    render(
      <PlacesToolbar
        query=""
        onQueryChange={noop}
        {...defaultProps}
        sort="recent"
      />,
      { wrapper }
    );
    const trigger = screen.getByLabelText("Sort places");
    expect(trigger).toHaveTextContent("Recent activity");
    expect(trigger).not.toHaveTextContent(/^recent$/);
  });

  it.each([
    ["visits", "Most visits"],
    ["name", "Name A–Z"],
    ["time_spent", "Most time spent"],
  ] as const)("maps sort=%s to label %s", (sort, label) => {
    render(
      <PlacesToolbar
        query=""
        onQueryChange={noop}
        {...defaultProps}
        sort={sort}
        count={1}
      />,
      { wrapper }
    );
    expect(screen.getByLabelText("Sort places")).toHaveTextContent(label);
  });

  it("calls onQueryChange as the user types", async () => {
    const onQueryChange = vi.fn();
    const user = userEvent.setup();
    render(
      <PlacesToolbar
        query=""
        onQueryChange={onQueryChange}
        {...defaultProps}
        count={0}
      />,
      { wrapper }
    );
    await user.type(screen.getByLabelText("Search places"), "ab");
    expect(onQueryChange).toHaveBeenCalled();
  });

  it("shows tag filter select when tags are available", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ tags: ["coffee", "work"] }),
    } as unknown as Response);

    render(
      <PlacesToolbar query="" onQueryChange={noop} {...defaultProps} />,
      { wrapper }
    );

    await waitFor(() => {
      expect(screen.getByLabelText("Filter by tag")).toBeInTheDocument();
    });
  });

  it("calls onTagFilterChange with the selected tag", async () => {
    const user = userEvent.setup();
    const onTagFilterChange = vi.fn();
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ tags: ["coffee"] }),
    } as unknown as Response);

    render(
      <PlacesToolbar
        query=""
        onQueryChange={noop}
        {...defaultProps}
        onTagFilterChange={onTagFilterChange}
      />,
      { wrapper }
    );

    await waitFor(() => expect(screen.getByLabelText("Filter by tag")).toBeInTheDocument());
    await user.click(screen.getByLabelText("Filter by tag"));
    await user.click(await screen.findByRole("option", { name: "coffee" }));

    expect(onTagFilterChange).toHaveBeenCalledWith("coffee");
  });

  it("does not show tag filter when no tags exist", async () => {
    render(
      <PlacesToolbar query="" onQueryChange={noop} {...defaultProps} />,
      { wrapper }
    );

    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByLabelText("Filter by tag")).not.toBeInTheDocument();
  });
});
