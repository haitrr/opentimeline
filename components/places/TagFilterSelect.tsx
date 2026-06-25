"use client";

import { useState } from "react";
import { CheckIcon, ChevronDownIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Props = {
  selected: string[];
  onChange: (tags: string[]) => void;
  availableTags: string[];
};

export default function TagFilterSelect({ selected, onChange, availableTags }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = availableTags.filter((tag) =>
    tag.toLowerCase().includes(search.toLowerCase())
  );

  function toggle(tag: string) {
    if (selected.includes(tag)) {
      onChange(selected.filter((t) => t !== tag));
    } else {
      onChange([...selected, tag]);
    }
  }

  const label =
    selected.length === 0
      ? "All tags"
      : selected.length === 1
        ? selected[0]
        : `${selected.length} tags`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1 text-xs"
          aria-label="Filter by tag"
        >
          <span>{label}</span>
          <ChevronDownIcon className="h-3 w-3 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-52 p-2" align="end" sideOffset={4}>
        <Input
          placeholder="Search tags…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-2 h-7 text-xs"
        />
        {filtered.length === 0 ? (
          <p className="py-2 text-center text-xs text-muted-foreground">No tags found</p>
        ) : (
          <ul className="max-h-48 overflow-y-auto">
            {filtered.map((tag) => {
              const isSelected = selected.includes(tag);
              return (
                <li key={tag}>
                  <button
                    type="button"
                    onClick={() => toggle(tag)}
                    className={`flex w-full items-center gap-2 rounded px-2 py-1 text-xs hover:bg-accent ${
                      isSelected ? "font-medium" : ""
                    }`}
                  >
                    <span
                      className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm border ${
                        isSelected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-muted-foreground"
                      }`}
                    >
                      {isSelected && <CheckIcon className="h-2.5 w-2.5" />}
                    </span>
                    {tag}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {selected.length > 0 && (
          <button
            type="button"
            onClick={() => onChange([])}
            className="mt-1.5 w-full rounded py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            Clear all
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}
