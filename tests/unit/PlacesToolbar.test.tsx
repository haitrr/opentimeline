import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import PlacesToolbar from "@/components/places/PlacesToolbar";

describe("PlacesToolbar", () => {
  const noop = () => {};

  it("shows the sort label (not the raw value) in the trigger", () => {
    render(
      <PlacesToolbar
        query=""
        onQueryChange={noop}
        sort="recent"
        onSortChange={noop}
        count={3}
      />
    );
    const trigger = screen.getByLabelText("Sort places");
    expect(trigger).toHaveTextContent("Recent activity");
    expect(trigger).not.toHaveTextContent(/^recent$/);
  });

  it.each([
    ["visits", "Most visits"],
    ["name", "Name A–Z"],
  ] as const)("maps sort=%s to label %s", (sort, label) => {
    render(
      <PlacesToolbar
        query=""
        onQueryChange={noop}
        sort={sort}
        onSortChange={noop}
        count={1}
      />
    );
    expect(screen.getByLabelText("Sort places")).toHaveTextContent(label);
  });

  it("calls onQueryChange as the user types", async () => {
    const onQueryChange = vi.fn();
    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    render(
      <PlacesToolbar
        query=""
        onQueryChange={onQueryChange}
        sort="recent"
        onSortChange={noop}
        count={0}
      />
    );
    await user.type(screen.getByLabelText("Search places"), "ab");
    expect(onQueryChange).toHaveBeenCalled();
  });
});
