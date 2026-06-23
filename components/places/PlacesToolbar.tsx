"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import useDebounce from "@/lib/useDebounce";

export type PlacesSort = "recent" | "visits" | "name" | "time_spent";

const SORT_LABELS: Record<PlacesSort, string> = {
  recent: "Recent activity",
  visits: "Most visits",
  name: "Name A–Z",
  time_spent: "Most time spent",
};

type Props = {
  query: string;
  onQueryChange: (next: string) => void;
  sort: PlacesSort;
  onSortChange: (next: PlacesSort) => void;
  count: number;
};

export default function PlacesToolbar({
  query,
  onQueryChange,
  sort,
  onSortChange,
  count,
}: Props) {
  const [focused, setFocused] = useState(false);
  const debouncedQuery = useDebounce(query, 200);

  const { data: tagSuggestions = [] } = useQuery<string[]>({
    queryKey: ["tags", "autocomplete", debouncedQuery],
    queryFn: async () => {
      const res = await fetch(`/api/tags?q=${encodeURIComponent(debouncedQuery)}`);
      if (!res.ok) return [];
      const data = await res.json();
      return data.tags as string[];
    },
    enabled: focused && debouncedQuery.length > 0,
  });

  const showDropdown = focused && debouncedQuery.length > 0 && tagSuggestions.length > 0;

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    onQueryChange(e.target.value);
  }

  return (
    <div className="flex flex-col gap-2 border-b px-3 py-2">
      <div className="relative">
        <Input
          role="combobox"
          aria-expanded={showDropdown}
          aria-label="Search places"
          type="text"
          value={query}
          onChange={handleChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          placeholder="Search places…"
          className="h-9 w-full text-base md:h-8 md:text-xs"
        />
        {showDropdown && (
          <ul
            role="listbox"
            className="absolute left-0 top-full z-50 mt-1 w-full rounded-md border bg-popover p-1 shadow-md"
          >
            <li className="px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Tags
            </li>
            {tagSuggestions.map((tag) => (
              <li key={tag} role="option" aria-selected={false}>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onQueryChange(tag);
                    setFocused(false);
                  }}
                  className="w-full rounded px-2 py-1 text-left text-xs hover:bg-accent"
                >
                  {tag}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <p className="order-last text-[11px] text-muted-foreground md:order-0">
          {count} {count === 1 ? "place" : "places"}
        </p>
        <Select
          value={sort}
          onValueChange={(v) => onSortChange(v as PlacesSort)}
        >
          <SelectTrigger
            size="sm"
            className="h-8 w-full justify-between text-xs md:w-fit"
            aria-label="Sort places"
          >
            <SelectValue>{SORT_LABELS[sort]}</SelectValue>
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false} sideOffset={4}>
            <SelectItem value="recent">Recent activity</SelectItem>
            <SelectItem value="visits">Most visits</SelectItem>
            <SelectItem value="time_spent">Most time spent</SelectItem>
            <SelectItem value="name">Name A–Z</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
