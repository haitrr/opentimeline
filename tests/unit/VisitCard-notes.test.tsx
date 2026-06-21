import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import VisitCard, { type Visit } from "@/components/VisitCard";

vi.mock("@/components/VisitPhotos", () => ({
  FetchVisitPhotos: () => null,
}));

const BASE_VISIT: Visit = {
  id: 1,
  arrivalAt: "2026-05-01T10:00:00Z",
  departureAt: "2026-05-01T12:00:00Z",
  status: "confirmed",
};

const BASE_PROPS = {
  visit: BASE_VISIT,
  gapPx: 0,
  gapMs: 0,
  hasDateSeparator: false,
  nextYear: null,
  nextMonthLabel: null,
  isLast: true,
  onConfirm: vi.fn(),
  onReject: vi.fn(),
  onEdit: vi.fn(),
  onCreatePlace: vi.fn(),
  onViewDay: vi.fn(),
};

describe("VisitCard notes", () => {
  it("renders plain text notes when present", () => {
    render(
      <VisitCard
        {...BASE_PROPS}
        visit={{ ...BASE_VISIT, notes: "Plain text note" }}
      />
    );
    expect(screen.getByText("Plain text note")).toBeInTheDocument();
  });

  it("renders markdown bold text in notes", () => {
    render(
      <VisitCard
        {...BASE_PROPS}
        visit={{ ...BASE_VISIT, notes: "**bold note**" }}
      />
    );
    const bold = screen.getByText("bold note");
    expect(bold.tagName).toBe("STRONG");
  });

  it("does not render notes section when notes is absent", () => {
    render(<VisitCard {...BASE_PROPS} visit={{ ...BASE_VISIT }} />);
    expect(screen.queryByTestId("visit-notes")).not.toBeInTheDocument();
  });

  it("does not render notes section when notes is empty string", () => {
    render(<VisitCard {...BASE_PROPS} visit={{ ...BASE_VISIT, notes: "" }} />);
    expect(screen.queryByTestId("visit-notes")).not.toBeInTheDocument();
  });
});
