"use client";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type PlacesSort = "recent" | "visits" | "name";

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
  return (
    <div className="flex flex-col gap-2 border-b px-3 py-2">
      <div className="flex items-center gap-2">
        <Input
          type="text"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search places…"
          className="h-8 flex-1 text-xs"
          aria-label="Search places"
        />
        <Select
          value={sort}
          onValueChange={(v) => onSortChange(v as PlacesSort)}
        >
          <SelectTrigger size="sm" className="h-8 text-xs" aria-label="Sort places">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recent">Recent activity</SelectItem>
            <SelectItem value="visits">Most visits</SelectItem>
            <SelectItem value="name">Name A–Z</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <p className="text-[11px] text-muted-foreground">
        {count} {count === 1 ? "place" : "places"}
      </p>
    </div>
  );
}
