import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import PlacesPanel from "@/components/PlacesPanel";

const FIXTURES = [
  {
    id: 1, name: "Home", lat: 1, lon: 2, radius: 50, isActive: true,
    totalVisits: 100, confirmedVisits: 100, visitsInRange: 100,
    confirmedVisitsInRange: 100, suggestedVisitsInRange: 0,
    lastVisitAt: new Date(Date.now() - 86_400_000).toISOString(),
    createdAt: "2025-01-01T00:00:00Z",
  },
  {
    id: 2, name: "Office", lat: 3, lon: 4, radius: 80, isActive: true,
    totalVisits: 50, confirmedVisits: 50, visitsInRange: 50,
    confirmedVisitsInRange: 50, suggestedVisitsInRange: 0,
    lastVisitAt: new Date(Date.now() - 3 * 86_400_000).toISOString(),
    createdAt: "2025-01-02T00:00:00Z",
  },
  {
    id: 3, name: "Airport", lat: 5, lon: 6, radius: 200, isActive: true,
    totalVisits: 5, confirmedVisits: 5, visitsInRange: 5,
    confirmedVisitsInRange: 5, suggestedVisitsInRange: 0,
    lastVisitAt: null,
    createdAt: "2025-01-03T00:00:00Z",
  },
];

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
    localStorage.clear();
    global.fetch = vi.fn(async (url: string | URL | Request) => {
      const u = String(url);
      if (u.endsWith("/api/places")) {
        return new Response(JSON.stringify(FIXTURES), { status: 200 });
      }
      return new Response("not found", { status: 404 });
    }) as typeof fetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows the empty state when places list is empty", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(JSON.stringify([]), { status: 200 })
    );
    renderPanel();
    expect(await screen.findByText("No places yet")).toBeInTheDocument();
  });

  it("filters by query (case-insensitive)", async () => {
    const user = userEvent.setup();
    renderPanel();
    await screen.findByText("Home");
    await user.type(screen.getByLabelText("Search places"), "off");
    expect(screen.getByText("Office")).toBeInTheDocument();
    expect(screen.queryByText("Home")).not.toBeInTheDocument();
    expect(screen.queryByText("Airport")).not.toBeInTheDocument();
  });

  it("shows 'No places match' with a clear button when filter is empty", async () => {
    const user = userEvent.setup();
    renderPanel();
    await screen.findByText("Home");
    const search = screen.getByLabelText("Search places");
    await user.type(search, "zzzz");
    expect(screen.getByText(/No places match/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /clear search/i }));
    expect(screen.getByText("Home")).toBeInTheDocument();
  });

  it("sorts by recent activity by default (nulls last)", async () => {
    renderPanel();
    await screen.findByText("Home");
    const names = screen.getAllByRole("button").map((b) => b.getAttribute("aria-label"));
    const placeOrder = names.filter((n): n is string => !!n && ["Home", "Office", "Airport"].includes(n));
    expect(placeOrder).toEqual(["Home", "Office", "Airport"]);
  });

  it("persists sort choice to localStorage", async () => {
    localStorage.setItem("places.sort", "visits");
    renderPanel();
    await screen.findByText("Home");
    const names = screen.getAllByRole("button").map((b) => b.getAttribute("aria-label"));
    const placeOrder = names.filter((n): n is string => !!n && ["Home", "Office", "Airport"].includes(n));
    expect(placeOrder).toEqual(["Home", "Office", "Airport"]);
  });
});
