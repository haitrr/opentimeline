import { describe, it, expect } from "vitest";
import { matchesShortcut } from "@/components/map/hooks/useKeyboardShortcuts";

describe("matchesShortcut", () => {
  const makeEvent = (overrides: Partial<KeyboardEvent> = {}): Pick<KeyboardEvent, "key" | "metaKey" | "ctrlKey" | "shiftKey" | "altKey"> => ({
    key: "",
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    ...overrides,
  });

  it("matches meta+p", () => {
    expect(matchesShortcut(makeEvent({ key: "p", metaKey: true }), { key: "p", meta: true })).toBe(true);
  });

  it("does not match when meta is not pressed", () => {
    expect(matchesShortcut(makeEvent({ key: "p", metaKey: false }), { key: "p", meta: true })).toBe(false);
  });

  it("does not match when wrong key is pressed", () => {
    expect(matchesShortcut(makeEvent({ key: "k", metaKey: true }), { key: "p", meta: true })).toBe(false);
  });

  it("does not match when extra modifier is pressed", () => {
    expect(matchesShortcut(makeEvent({ key: "p", metaKey: true, shiftKey: true }), { key: "p", meta: true })).toBe(false);
  });

  it("is case-insensitive for the key", () => {
    expect(matchesShortcut(makeEvent({ key: "P", metaKey: true }), { key: "p", meta: true })).toBe(true);
  });
});
