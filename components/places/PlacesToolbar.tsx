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

const SORT_LABELS: Record<PlacesSort, string> = {
  recent: "Recent activity",
  visits: "Most visits",
  name: "Name A–Z",
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
  return (
    <div className="flex flex-col gap-2 border-b px-3 py-2">
      <Input
        type="text"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        placeholder="Search places…"
        className="h-9 w-full text-base md:h-8 md:text-xs"
        aria-label="Search places"
      />
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
            <SelectItem value="name">Name A–Z</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
