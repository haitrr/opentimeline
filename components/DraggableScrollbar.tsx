"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const SCROLL_LABEL_HIDE_DELAY = 1200; // ms after last scroll event before hiding the label

export type ScrollSegment = {
  /** Full label shown in hover/scroll bubbles, e.g. "Mon, 24 Feb" or "Feb 2026" */
  label: string;
  /** Short label on the track (e.g. year "2026" or month "Feb"). Omit to skip. */
  shortLabel?: string;
  /**
   * Must match the value of `data-scrubber-segment` on the corresponding DOM
   * separator element inside the scroll container. Used to look up real offsetTop.
   */
  segmentKey: string;
};

interface Props {
  segments: ScrollSegment[];
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  className?: string;
}

const PADDING_Y = 8;
const MIN_LABEL_GAP = 14;

type ResolvedMark = ScrollSegment & { fraction: number };

export default function DraggableScrollbar({
  segments,
  scrollContainerRef,
  className = "",
}: Props) {
  const trackRef = useRef<HTMLDivElement>(null);

  const [scrollPct, setScrollPct] = useState(0);
  const [isHover, setIsHover] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [hoverY, setHoverY] = useState(0);
  const [hoverLabel, setHoverLabel] = useState<string | null>(null);
  const [scrollLabel, setScrollLabel] = useState<string | null>(null);
  const scrollLabelTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Resolved marks with actual DOM-based fractions
  const [marks, setMarks] = useState<ResolvedMark[]>([]);

  // ── Measure real DOM positions ───────────────────────────────────────────
  const resolveMarks = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container || segments.length === 0) { setMarks([]); return; }

    const totalHeight = container.scrollHeight;
    if (totalHeight === 0) return;

    const resolved: ResolvedMark[] = segments.map((seg) => {
      const el = container.querySelector(
        `[data-scrubber-segment="${CSS.escape(seg.segmentKey)}"]`
      ) as HTMLElement | null;
      // Walk offsetParent chain to get position relative to the container
      let top = 0;
      let node: HTMLElement | null = el;
      while (node && node !== container) {
        top += node.offsetTop;
        node = node.offsetParent as HTMLElement | null;
      }
      return { ...seg, fraction: Math.min(1, top / totalHeight) };
    });
    setMarks(resolved);
  }, [scrollContainerRef, segments]);

  // Re-measure when content height / DOM changes
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    resolveMarks();

    const ro = new ResizeObserver(resolveMarks);
    ro.observe(container);
    const mo = new MutationObserver(resolveMarks);
    mo.observe(container, { childList: true, subtree: false });

    return () => { ro.disconnect(); mo.disconnect(); };
  }, [scrollContainerRef, resolveMarks]);

  // ── Sync scroll position ─────────────────────────────────────────────────
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;

    const onScroll = () => {
      const max = el.scrollHeight - el.clientHeight;
      const pct = max > 0 ? el.scrollTop / max : 0;
      setScrollPct(pct);

      if (marks.length > 0) {
        let best = marks[0];
        for (const m of marks) { if (m.fraction <= pct) best = m; }
        setScrollLabel(best.label);
      }

      if (scrollLabelTimer.current) clearTimeout(scrollLabelTimer.current);
      scrollLabelTimer.current = setTimeout(() => {
        setScrollLabel(null);
        scrollLabelTimer.current = null;
      }, SCROLL_LABEL_HIDE_DELAY);
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      if (scrollLabelTimer.current) clearTimeout(scrollLabelTimer.current);
    };
  }, [scrollContainerRef, marks]);

  // ── Helpers ──────────────────────────────────────────────────────────────
  const innerHeight = useCallback(() => {
    const h = trackRef.current?.clientHeight ?? 0;
    return Math.max(1, h - PADDING_Y * 2);
  }, []);

  const getLabelAt = useCallback(
    (relY: number): string | null => {
      if (marks.length === 0) return null;
      const pct = relY / innerHeight();
      let best = marks[0];
      for (const m of marks) { if (m.fraction <= pct) best = m; }
      return best.label;
    },
    [marks, innerHeight]
  );

  const scrollTo = useCallback(
    (relY: number) => {
      const el = scrollContainerRef.current;
      if (!el) return;
      const max = el.scrollHeight - el.clientHeight;
      el.scrollTop = (relY / innerHeight()) * max;
    },
    [scrollContainerRef, innerHeight]
  );

  const applyPosition = useCallback(
    (clientY: number, drag: boolean) => {
      const track = trackRef.current;
      if (!track) return;
      const rect = track.getBoundingClientRect();
      const relY = Math.max(0, Math.min(clientY - rect.top - PADDING_Y, rect.height - PADDING_Y * 2));
      setHoverY(relY);
      setHoverLabel(getLabelAt(relY));
      if (drag) scrollTo(relY);
    },
    [getLabelAt, scrollTo]
  );

  // Global drag listeners
  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e: MouseEvent) => applyPosition(e.clientY, true);
    const onUp = () => setIsDragging(false);
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, [isDragging, applyPosition]);

  // ── Render geometry ──────────────────────────────────────────────────────
  const ih = innerHeight();

  const tickMarks = marks.map((m) => ({ ...m, y: PADDING_Y + m.fraction * ih }));

  const visibleLabels: typeof tickMarks = [];
  let lastLabelY = -Infinity;
  for (const m of tickMarks) {
    if (m.shortLabel !== undefined && m.y - lastLabelY >= MIN_LABEL_GAP) {
      visibleLabels.push(m);
      lastLabelY = m.y;
    }
  }

  const indicatorY = PADDING_Y + scrollPct * ih;

  return (
    <div
      ref={trackRef}
      data-id="scrubber"
      aria-hidden="true"
      className={`relative shrink-0 select-none ${className}`}
      style={{ cursor: "row-resize" }}
      onMouseEnter={() => setIsHover(true)}
      onMouseLeave={() => setIsHover(false)}
      onMouseMove={(e) => applyPosition(e.clientY, isDragging)}
      onMouseDown={(e) => { e.preventDefault(); setIsDragging(true); applyPosition(e.clientY, true); }}
    >
      {/* Track line */}
      <div
        className="pointer-events-none absolute bottom-2 top-2 w-px rounded-full bg-gray-200 dark:bg-gray-700"
        style={{ left: "calc(50% - 0.5px)" }}
      />

      {/* Tick marks */}
      {tickMarks.map((m, i) => (
        <div
          key={i}
          className="pointer-events-none absolute h-px rounded-full bg-gray-300 dark:bg-gray-600"
          style={{ top: m.y, right: 0, left: "40%" }}
        />
      ))}

      {/* Short labels */}
      {visibleLabels.map((m, i) => (
        <div
          key={i}
          className="pointer-events-none absolute right-1 font-mono text-[9px] leading-none text-gray-400 dark:text-gray-500"
          style={{ top: `${m.y - 5}px` }}
        >
          {m.shortLabel}
        </div>
      ))}

      {/* Scroll indicator line */}
      <div
        className="pointer-events-none absolute h-0.5 rounded-sm bg-blue-500/70"
        style={{ top: indicatorY, left: 0, right: 0 }}
      />

      {/* Scroll label (while mouse-wheel scrolling) */}
      {scrollLabel && !isHover && !isDragging && (
        <div
          className="pointer-events-none absolute right-full z-50 mr-1.5 whitespace-nowrap rounded border border-blue-200 bg-white px-2 py-0.5 text-xs font-medium text-blue-700 shadow-sm dark:border-blue-800 dark:bg-gray-800 dark:text-blue-300"
          style={{ top: indicatorY - 10 }}
        >
          {scrollLabel}
        </div>
      )}

      {/* Hover / drag label */}
      {(isHover || isDragging) && hoverLabel && (
        <div
          className="pointer-events-none absolute right-full z-50 mr-1.5 whitespace-nowrap rounded border border-gray-200 bg-white px-2 py-0.5 text-xs font-medium text-gray-700 shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
          style={{ top: hoverY + PADDING_Y - 10 }}
        >
          {hoverLabel}
        </div>
      )}
    </div>
  );
}

