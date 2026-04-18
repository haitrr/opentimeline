import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import PlacesPanel from "@/components/PlacesPanel";

const FIXTURES = [
  {
    id: 1,
    name: "Home",
    lat: 1,
    lon: 2,
    radius: 50,
    isActive: true,
    totalVisits: 100,
    confirmedVisits: 100,
    visitsInRange: 100,
    confirmedVisitsInRange: 100,
    suggestedVisitsInRange: 0,
    lastVisitAt: new Date(Date.now() - 86_400_000).toISOString(),
    createdAt: "2025-01-01T00:00:00Z",
  },
  {
    id: 2,
    name: "Office",
    lat: 3,
    lon: 4,
    radius: 80,
    isActive: true,
    totalVisits: 50,
    confirmedVisits: 50,
    visitsInRange: 50,
    confirmedVisitsInRange: 50,
    suggestedVisitsInRange: 0,
    lastVisitAt: new Date(Date.now() - 3 * 86_400_000).toISOString(),
    createdAt: "2025-01-02T00:00:00Z",
  },
  {
    id: 3,
    name: "Airport",
    lat: 5,
    lon: 6,
    radius: 200,
    isActive: true,
    totalVisits: 5,
    confirmedVisits: 5,
    visitsInRange: 5,
    confirmedVisitsInRange: 5,
    suggestedVisitsInRange: 0,
    lastVisitAt: null,
    createdAt: "2025-01-03T00:00:00Z",
  },
];

class FakeIntersectionObserver {
  observe() {}
  disconnect() {}
  unobserve() {}
  takeRecords() {
    return [];
  }
  root = null;
  rootMargin = "";
  thresholds = [];
}

function paginatedFor(rawUrl: string): Response {
  const url = new URL(rawUrl, "http://localhost");
  const q = (url.searchParams.get("q") || "").toLowerCase();
  const sort = url.searchParams.get("sort") || "recent";
  const limit = Number(url.searchParams.get("limit") || "50");
  const offset = Number(url.searchParams.get("offset") || "0");

  let places = [...FIXTURES];
  if (q) places = places.filter((p) => p.name.toLowerCase().includes(q));

  if (sort === "visits") {
    places.sort((a, b) => b.confirmedVisits - a.confirmedVisits);
  } else if (sort === "name") {
    places.sort((a, b) => a.name.localeCompare(b.name));
  } else {
    places.sort((a, b) => {
      const ta = a.lastVisitAt ? new Date(a.lastVisitAt).getTime() : -Infinity;
      const tb = b.lastVisitAt ? new Date(b.lastVisitAt).getTime() : -Infinity;
      return tb - ta;
    });
  }

  const page = places.slice(offset, offset + limit);
  const nextOffset = offset + limit < places.length ? offset + limit : null;
  return new Response(JSON.stringify({ places: page, nextOffset }), {
    status: 200,
  });
}

function renderPanel() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <PlacesPanel />
    </QueryClientProvider>
  );
}

describe("PlacesPanel", () => {
  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).IntersectionObserver = FakeIntersectionObserver;
    localStorage.clear();
    global.fetch = vi.fn(async (input: string | URL | Request) => {
      const u = String(input);
      if (u === "/api/places" || u.startsWith("/api/places?")) {
        return paginatedFor(u);
      }
      return new Response("not found", { status: 404 });
    }) as typeof fetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows the empty state when the first page is empty and no query is set", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(JSON.stringify({ places: [], nextOffset: null }), {
        status: 200,
      })
    );
    renderPanel();
    expect(await screen.findByText("No places yet")).toBeInTheDocument();
  });

  it("sends q= to the server after the search input debounces", async () => {
    const user = userEvent.setup();
    renderPanel();
    await screen.findByText("Home");

    await user.type(screen.getByLabelText("Search places"), "off");

    await waitFor(
      () => {
        const calls = (
          global.fetch as ReturnType<typeof vi.fn>
        ).mock.calls.map((c) => String(c[0]));
        expect(calls.some((u) => u.includes("q=off"))).toBe(true);
      },
      { timeout: 2000 }
    );

    await waitFor(() => {
      expect(screen.getByText("Office")).toBeInTheDocument();
      expect(screen.queryByText("Home")).not.toBeInTheDocument();
      expect(screen.queryByText("Airport")).not.toBeInTheDocument();
    });
  });

  it("shows the no-match block with a clear button when the query returns nothing", async () => {
    const user = userEvent.setup();
    renderPanel();
    await screen.findByText("Home");
    await user.type(screen.getByLabelText("Search places"), "zzzz");
    expect(
      await screen.findByText(/No places match/i, undefined, { timeout: 2000 })
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /clear search/i }));
    await waitFor(() => expect(screen.getByText("Home")).toBeInTheDocument());
  });

  it("requests sort=recent by default", async () => {
    renderPanel();
    await screen.findByText("Home");
    const firstUrl = String(
      (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0]
    );
    expect(firstUrl).toContain("sort=recent");
    expect(firstUrl).toContain("offset=0");
    expect(firstUrl).toContain("limit=50");
  });

  it("reads sort from localStorage on mount", async () => {
    localStorage.setItem("places.sort", "visits");
    renderPanel();
    await screen.findByText("Home");
    const firstUrl = String(
      (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0]
    );
    expect(firstUrl).toContain("sort=visits");
  });

  it("writes the selected sort to localStorage and refetches", async () => {
    const user = userEvent.setup();
    renderPanel();
    await screen.findByText("Home");
    await user.click(screen.getByLabelText("Sort places"));
    await user.click(await screen.findByRole("option", { name: "Name A–Z" }));
    expect(localStorage.getItem("places.sort")).toBe("name");
    await waitFor(() => {
      const calls = (
        global.fetch as ReturnType<typeof vi.fn>
      ).mock.calls.map((c) => String(c[0]));
      expect(calls.some((u) => u.includes("sort=name"))).toBe(true);
    });
  });

  it("deletes via DELETE /api/places/:id", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    renderPanel();
    await screen.findByText("Home");

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(JSON.stringify({ deleted: true }), { status: 200 })
    );

    const deleteButtons = screen.getAllByRole("button", {
      name: /delete place/i,
    });
    await user.click(deleteButtons[0]);

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/places/1",
      expect.objectContaining({ method: "DELETE" })
    );
  });
});
