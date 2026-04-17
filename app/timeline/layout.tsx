"use client";

import { useState, useMemo, Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import MapWrapper from "@/components/map/MapWrapper";
import PlacesPanel from "@/components/PlacesPanel";
import VisitSuggestionsPanel from "@/components/VisitSuggestionsPanel";
import UnknownVisitSuggestionsPanel from "@/components/UnknownVisitSuggestionsPanel";
import ImportGpxButton from "@/components/ImportGpxButton";
import ImportImmichButton from "@/components/ImportImmichButton";
import SettingsModal from "@/components/SettingsModal";
import AsideHeader from "@/components/AsideHeader";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getRangeBounds } from "@/lib/getRangeBounds";
import type { RangeType } from "@/app/timeline/[date]/page";

const VALID_RANGES: RangeType[] = ["day", "week", "month", "year", "custom", "all"];

function SettingsIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
      <path fillRule="evenodd" d="M7.84 1.804A1 1 0 0 1 8.82 1h2.36a1 1 0 0 1 .98.804l.223 1.164a6.98 6.98 0 0 1 1.48.85l1.08-.54a1 1 0 0 1 1.232.236l1.668 1.668a1 1 0 0 1 .236 1.232l-.54 1.08c.332.46.616.958.85 1.48l1.164.223a1 1 0 0 1 .804.98v2.36a1 1 0 0 1-.804.98l-1.164.223a6.98 6.98 0 0 1-.85 1.48l.54 1.08a1 1 0 0 1-.236 1.232l-1.668 1.668a1 1 0 0 1-1.232.236l-1.08-.54a6.98 6.98 0 0 1-1.48.85l-.223 1.164a1 1 0 0 1-.98.804H8.82a1 1 0 0 1-.98-.804l-.223-1.164a6.98 6.98 0 0 1-1.48-.85l-1.08.54a1 1 0 0 1-1.232-.236L2.157 16.61a1 1 0 0 1-.236-1.232l.54-1.08a6.98 6.98 0 0 1-.85-1.48l-1.164-.223A1 1 0 0 1 .643 11.615v-2.36a1 1 0 0 1 .804-.98l1.164-.223a6.98 6.98 0 0 1 .85-1.48l-.54-1.08a1 1 0 0 1 .236-1.232L4.825 2.592a1 1 0 0 1 1.232-.236l1.08.54c.46-.332.958-.616 1.48-.85l.223-1.164ZM10 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" clipRule="evenodd" />
    </svg>
  );
}

function SidebarContent({
  onClose,
  onDetect,
  detecting,
  rangeStart,
  rangeEnd,
  settingsOpen,
  setSettingsOpen,
  setSettingsModalOpen,
  children,
}: {
  onClose: () => void;
  onDetect: () => void;
  detecting: boolean;
  rangeStart?: string;
  rangeEnd?: string;
  settingsOpen: boolean;
  setSettingsOpen: (open: boolean) => void;
  setSettingsModalOpen: (open: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <>
      <AsideHeader onClose={onClose} onDetect={onDetect} detecting={detecting} />
      {children}
      <PlacesPanel />
      <VisitSuggestionsPanel />
      <UnknownVisitSuggestionsPanel />
      <div className="absolute bottom-4 left-4 z-10">
        {settingsOpen && (
          <div className="absolute bottom-full left-0 mb-2 w-56 rounded-md border bg-background p-2 shadow-lg">
            <ImportGpxButton />
            <ImportImmichButton rangeStart={rangeStart} rangeEnd={rangeEnd} />
            <div className="my-1 border-t" />
            <button
              type="button"
              onClick={() => { setSettingsOpen(false); setSettingsModalOpen(true); }}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-foreground hover:bg-muted"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0">
                <path fillRule="evenodd" d="M7.84 1.804A1 1 0 0 1 8.82 1h2.36a1 1 0 0 1 .98.804l.223 1.164a6.98 6.98 0 0 1 1.48.85l1.08-.54a1 1 0 0 1 1.232.236l1.668 1.668a1 1 0 0 1 .236 1.232l-.54 1.08c.332.46.616.958.85 1.48l1.164.223a1 1 0 0 1 .804.98v2.36a1 1 0 0 1-.804.98l-1.164.223a6.98 6.98 0 0 1-.85 1.48l.54 1.08a1 1 0 0 1-.236 1.232l-1.668 1.668a1 1 0 0 1-1.232.236l-1.08-.54a6.98 6.98 0 0 1-1.48.85l-.223 1.164a1 1 0 0 1-.98.804H8.82a1 1 0 0 1-.98-.804l-.223-1.164a6.98 6.98 0 0 1-1.48-.85l-1.08.54a1 1 0 0 1-1.232-.236L2.157 16.61a1 1 0 0 1-.236-1.232l.54-1.08a6.98 6.98 0 0 1-.85-1.48l-1.164-.223A1 1 0 0 1 .643 11.615v-2.36a1 1 0 0 1 .804-.98l1.164-.223a6.98 6.98 0 0 1 .85-1.48l-.54-1.08a1 1 0 0 1 .236-1.232L4.825 2.592a1 1 0 0 1 1.232-.236l1.08.54c.46-.332.958-.616 1.48-.85l.223-1.164ZM10 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" clipRule="evenodd" />
              </svg>
              Settings
            </button>
          </div>
        )}
        <Tooltip>
          <TooltipTrigger>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setSettingsOpen(!settingsOpen)}
              aria-expanded={settingsOpen}
              aria-label="Open settings"
              className="rounded-full shadow-md"
            >
              <SettingsIcon />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Settings</TooltipContent>
        </Tooltip>
      </div>
    </>
  );
}

function TimelineShell({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const date = (params.date as string) ?? "";
  const range = (
    VALID_RANGES.includes(searchParams.get("range") as RangeType)
      ? searchParams.get("range")
      : "day"
  ) as RangeType;
  const endDate = searchParams.get("end") ?? undefined;
  const shouldAutoFit = searchParams.get("fit") === "1";

  const { rangeStart, rangeEnd } = useMemo(() => {
    if (!date) return { rangeStart: undefined, rangeEnd: undefined };
    if (range === "all") {
      return {
        rangeStart: new Date(0).toISOString(),
        rangeEnd: new Date().toISOString(),
      };
    }
    const parsedDate = new Date(`${date}T00:00:00`);
    if (isNaN(parsedDate.getTime())) return { rangeStart: undefined, rangeEnd: undefined };
    const { start, end } = getRangeBounds(parsedDate, range, endDate);
    return { rangeStart: start.toISOString(), rangeEnd: end.toISOString() };
  }, [date, range, endDate]);

  const [mobilePanelsOpen, setMobilePanelsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [detecting, setDetecting] = useState(false);

  async function detectVisits() {
    setDetecting(true);
    const body = JSON.stringify({
      ...(rangeStart ? { start: rangeStart } : {}),
      ...(rangeEnd ? { end: rangeEnd } : {}),
    });
    let total = 0;
    try {
      const r1 = await fetch("/api/visits/detect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
      if (r1.ok) {
        const { newVisits } = await r1.json();
        total += newVisits ?? 0;
        if (newVisits > 0) {
          queryClient.invalidateQueries({ queryKey: ["visits"] });
          queryClient.invalidateQueries({ queryKey: ["places"] });
        }
      }
      const r2 = await fetch("/api/unknown-visits/detect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
      if (r2.ok) {
        const { created } = await r2.json();
        total += created ?? 0;
        if (created > 0) {
          queryClient.invalidateQueries({ queryKey: ["unknown-visits"] });
          queryClient.invalidateQueries({ queryKey: ["places"] });
        }
      }
    } finally {
      setDetecting(false);
      setSettingsOpen(false);
      toast(
        total === 0
          ? "No new visit suggestions found"
          : `${total} new visit suggestion${total === 1 ? "" : "s"} detected`
      );
    }
  }

  const sidebarProps = {
    onDetect: detectVisits,
    detecting,
    rangeStart,
    rangeEnd,
    settingsOpen,
    setSettingsOpen,
    setSettingsModalOpen,
  };

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-muted md:h-screen md:w-screen md:flex-row">
      {/* Mobile Sheet */}
      <Sheet open={mobilePanelsOpen} onOpenChange={setMobilePanelsOpen}>
        <SheetContent side="left" className="flex w-[95vw] max-w-sm flex-col overflow-hidden p-0 md:hidden">
          <SheetTitle className="sr-only">Navigation Panel</SheetTitle>
          <SidebarContent {...sidebarProps} onClose={() => setMobilePanelsOpen(false)}>
            {children}
          </SidebarContent>
        </SheetContent>
      </Sheet>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex md:h-full md:w-120 md:max-w-[40vw] md:shrink-0 md:flex-col md:overflow-hidden md:border-r md:border md:bg-background md:shadow-none relative">
        <SidebarContent {...sidebarProps} onClose={() => {}}>
          {children}
        </SidebarContent>
      </aside>

      {settingsModalOpen && (
        <SettingsModal onClose={() => setSettingsModalOpen(false)} />
      )}

      <main className="relative min-h-0 flex-1">
        <MapWrapper rangeStart={rangeStart} rangeEnd={rangeEnd} shouldAutoFit={shouldAutoFit} />
        <Button
          size="icon"
          onClick={() => setMobilePanelsOpen((open) => !open)}
          className="absolute bottom-6 right-4 z-900 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg active:scale-95 md:hidden"
          aria-label="Toggle panel"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
            <path fillRule="evenodd" d="M3 6.75A.75.75 0 0 1 3.75 6h16.5a.75.75 0 0 1 0 1.5H3.75A.75.75 0 0 1 3 6.75ZM3 12a.75.75 0 0 1 .75-.75h16.5a.75.75 0 0 1 0 1.5H3.75A.75.75 0 0 1 3 12Zm0 5.25a.75.75 0 0 1 .75-.75H12a.75.75 0 0 1 0 1.5H3.75a.75.75 0 0 1-.75-.75Z" clipRule="evenodd" />
          </svg>
        </Button>
      </main>
    </div>
  );
}

export default function TimelineLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense>
      <TimelineShell>{children}</TimelineShell>
    </Suspense>
  );
}
