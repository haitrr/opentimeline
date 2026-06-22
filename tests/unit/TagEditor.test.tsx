import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import TagEditor from "@/components/places/TagEditor";

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe("TagEditor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it("renders existing tags as removable pills", () => {
    render(
      <TagEditor placeId={1} initialTags={["coffee", "work"]} inline />,
      { wrapper }
    );
    expect(screen.getByText("coffee")).toBeInTheDocument();
    expect(screen.getByText("work")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /remove/i })).toHaveLength(2);
  });

  it("normalizes input to lowercase and calls PUT /api/places/:id/tags on Enter", async () => {
    const user = userEvent.setup();
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ tags: ["coffee"] }) } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ tags: [] }) } as Response);

    render(<TagEditor placeId={1} initialTags={[]} inline />, { wrapper });

    const input = screen.getByRole("textbox");
    await user.type(input, "Coffee{Enter}");

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/places/1/tags",
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify({ tags: ["coffee"] }),
        })
      );
    });
  });

  it("removes a tag when × is clicked and calls PUT /api/places/:id/tags", async () => {
    const user = userEvent.setup();
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ tags: ["work"] }),
    } as Response);

    render(<TagEditor placeId={1} initialTags={["coffee", "work"]} inline />, { wrapper });

    const removeButtons = screen.getAllByRole("button", { name: /remove coffee/i });
    await user.click(removeButtons[0]);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/places/1/tags",
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify({ tags: ["work"] }),
        })
      );
    });
  });

  it("does not add duplicate tags", async () => {
    const user = userEvent.setup();

    render(<TagEditor placeId={1} initialTags={["coffee"]} inline />, { wrapper });

    const input = screen.getByRole("textbox");
    await user.type(input, "coffee{Enter}");

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("calls onTagsChange after successful save", async () => {
    const user = userEvent.setup();
    const onTagsChange = vi.fn();
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ tags: ["new"] }),
    } as Response);

    render(
      <TagEditor placeId={1} initialTags={[]} onTagsChange={onTagsChange} inline />,
      { wrapper }
    );

    await user.type(screen.getByRole("textbox"), "new{Enter}");

    await waitFor(() => {
      expect(onTagsChange).toHaveBeenCalledWith(["new"]);
    });
  });
});
