"use client";

import { useEffect } from "react";

type ShortcutDef = {
  key: string;
  meta?: boolean;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
};

type KeyLike = Pick<KeyboardEvent, "key" | "metaKey" | "ctrlKey" | "shiftKey" | "altKey">;

export function matchesShortcut(event: KeyLike, shortcut: ShortcutDef): boolean {
  if (event.key.toLowerCase() !== shortcut.key.toLowerCase()) return false;
  if (event.metaKey !== (shortcut.meta ?? false)) return false;
  if (event.ctrlKey !== (shortcut.ctrl ?? false)) return false;
  if (event.shiftKey !== (shortcut.shift ?? false)) return false;
  if (event.altKey !== (shortcut.alt ?? false)) return false;
  return true;
}

type Shortcut = {
  shortcut: ShortcutDef;
  handler: () => void;
};

export function useKeyboardShortcuts(shortcuts: Shortcut[]) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      for (const { shortcut, handler } of shortcuts) {
        if (matchesShortcut(e, shortcut)) {
          e.preventDefault();
          handler();
          return;
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [shortcuts]);
}
