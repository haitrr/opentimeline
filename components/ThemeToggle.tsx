"use client";

import { Button } from "@/components/ui/button";

export default function ThemeToggle() {
  function toggleTheme() {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={toggleTheme}
      aria-label="Toggle theme"
      title="Toggle theme"
    >
      Theme
    </Button>
  );
}
