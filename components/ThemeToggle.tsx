"use client";

export default function ThemeToggle() {
  function toggleTheme() {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="rounded border border-gray-200 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
      aria-label="Toggle theme"
      title="Toggle theme"
    >
      Theme
    </button>
  );
}
