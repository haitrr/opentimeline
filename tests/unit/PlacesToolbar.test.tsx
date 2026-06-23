import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import PlacesToolbar from "@/components/places/PlacesToolbar";

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

  it("shows the sort label (not the raw value) in the trigger", () => {
    render(
      <PlacesToolbar
        query=""
        onQueryChange={noop}
        sort="recent"
        onSortChange={noop}
        count={3}
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
        sort={sort}
        onSortChange={noop}
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
        sort="recent"
        onSortChange={noop}
        count={0}
      />,
      { wrapper }
    );
    await user.type(screen.getByRole("combobox", { name: /search places/i }), "ab");
    expect(onQueryChange).toHaveBeenCalled();
  });

  it("shows tag suggestions when user types and tags are available", async () => {
    const user = userEvent.setup();
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ tags: ["coffee", "cafe"] }),
    } as unknown as Response);

    render(
      <PlacesToolbar query="" onQueryChange={noop} sort="recent" onSortChange={noop} count={3} />,
      { wrapper }
    );

    const input = screen.getByRole("combobox", { name: /search places/i });
    await user.type(input, "c");

    await waitFor(() => {
      expect(screen.getByText("coffee")).toBeInTheDocument();
      expect(screen.getByText("cafe")).toBeInTheDocument();
    });
  });

  it("calls onQueryChange with the tag name when a suggestion is clicked", async () => {
    const user = userEvent.setup();
    const onQueryChange = vi.fn();
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ tags: ["coffee"] }),
    } as unknown as Response);

    render(
      <PlacesToolbar
        query="c"
        onQueryChange={onQueryChange}
        sort="recent"
        onSortChange={noop}
        count={3}
      />,
      { wrapper }
    );

    await waitFor(() => expect(screen.getByText("coffee")).toBeInTheDocument());
    await user.click(screen.getByText("coffee"));

    expect(onQueryChange).toHaveBeenCalledWith("coffee");
  });

  it("does not show the dropdown when query is empty", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ tags: ["coffee"] }),
    } as unknown as Response);

    render(
      <PlacesToolbar query="" onQueryChange={noop} sort="recent" onSortChange={noop} count={0} />,
      { wrapper }
    );

    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByText("coffee")).not.toBeInTheDocument();
  });
});
