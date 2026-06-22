"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { X, Tag } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

type Props = {
  placeId: number;
  initialTags: string[];
  onTagsChange?: (tags: string[]) => void;
  inline?: boolean;
};

function TagEditorInner({
  placeId,
  tags,
  setTags,
  onTagsChange,
}: {
  placeId: number;
  tags: string[];
  setTags: (tags: string[]) => void;
  onTagsChange?: (tags: string[]) => void;
}) {
  const [input, setInput] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const debouncedInput = useDebounce(input, 200);

  const { data: suggestions = [] } = useQuery<string[]>({
    queryKey: ["tags", "autocomplete", debouncedInput],
    queryFn: async () => {
      const res = await fetch(`/api/tags?q=${encodeURIComponent(debouncedInput)}`);
      if (!res.ok) return [];
      const data = await res.json();
      return (data.tags as string[]).filter((t) => !tags.includes(t));
    },
    enabled: showSuggestions && debouncedInput.length > 0,
  });

  async function saveTags(next: string[]) {
    const res = await fetch(`/api/places/${placeId}/tags`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tags: next }),
    });
    if (res.ok) {
      const data = await res.json();
      setTags(data.tags);
      queryClient.invalidateQueries({ queryKey: ["places"] });
      onTagsChange?.(data.tags);
    }
  }

  async function addTag(name: string) {
    const normalized = name.toLowerCase().trim();
    if (!normalized || tags.includes(normalized)) return;
    const next = [...tags, normalized];
    setInput("");
    setShowSuggestions(false);
    await saveTags(next);
  }

  async function removeTag(name: string) {
    const next = tags.filter((t) => t !== name);
    await saveTags(next);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      void addTag(input);
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      {tags.map((tag) => (
        <span
          key={tag}
          className="flex items-center gap-0.5 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary"
        >
          {tag}
          <button
            type="button"
            aria-label={`Remove ${tag}`}
            onClick={() => void removeTag(tag)}
            className="ml-0.5 rounded-full hover:text-destructive"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setShowSuggestions(true);
          }}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          onKeyDown={handleKeyDown}
          placeholder="Add tag…"
          className="h-6 w-24 rounded border border-dashed border-muted-foreground/40 bg-transparent px-2 text-xs placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-ring"
          style={{ fontSize: 16 }}
          aria-label="Add tag"
        />
        {showSuggestions && suggestions.length > 0 && (
          <ul className="absolute left-0 top-7 z-50 min-w-32 rounded-md border bg-popover p-1 shadow-md">
            {suggestions.map((s) => (
              <li key={s}>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    void addTag(s);
                  }}
                  className="w-full rounded px-2 py-1 text-left text-xs hover:bg-accent"
                >
                  {s}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export default function TagEditor({ placeId, initialTags, onTagsChange, inline = false }: Props) {
  const [tags, setTags] = useState(initialTags);
  const [open, setOpen] = useState(false);

  if (inline) {
    return (
      <TagEditorInner
        placeId={placeId}
        tags={tags}
        setTags={setTags}
        onTagsChange={onTagsChange}
      />
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      {tags.map((tag) => (
        <span
          key={tag}
          className="flex items-center gap-0.5 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary"
        >
          {tag}
        </span>
      ))}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="Edit tags"
            className="flex items-center gap-0.5 rounded-full border border-dashed border-muted-foreground/40 px-2 py-0.5 text-xs text-muted-foreground hover:border-primary hover:text-primary"
          >
            <Tag className="h-2.5 w-2.5" />
            {tags.length === 0 ? "tag" : "+"}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-2" align="start" side="bottom">
          <TagEditorInner
            placeId={placeId}
            tags={tags}
            setTags={(next) => {
              setTags(next);
              onTagsChange?.(next);
            }}
            onTagsChange={onTagsChange}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
