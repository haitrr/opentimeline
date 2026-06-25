"use client";

import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import TagFilterSelect from "@/components/places/TagFilterSelect";

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
  tagFilters: string[];
  onTagFiltersChange: (tags: string[]) => void;
  count: number;
};

export default function PlacesToolbar({
  query,
  onQueryChange,
  sort,
  onSortChange,
  tagFilters,
  onTagFiltersChange,
  count,
}: Props) {
  const { data: availableTags = [] } = useQuery<string[]>({
    queryKey: ["tags", "all"],
    queryFn: async () => {
      const res = await fetch("/api/tags?limit=100");
      if (!res.ok) return [];
      const data = await res.json();
      return data.tags as string[];
    },
  });

  return (
    <div className="flex flex-col gap-2 border-b px-3 py-2">
      <Input
        aria-label="Search places"
        type="text"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        placeholder="Search places…"
        className="h-9 w-full text-base md:h-8 md:text-xs"
      />
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <p className="order-last text-[11px] text-muted-foreground md:order-0">
          {count} {count === 1 ? "place" : "places"}
        </p>
        <div className="flex gap-2">
          {availableTags.length > 0 && (
            <TagFilterSelect
              selected={tagFilters}
              onChange={onTagFiltersChange}
              availableTags={availableTags}
            />
          )}
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
    </div>
  );
}
