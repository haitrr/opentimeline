"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import MapWrapper from "@/components/map/MapWrapper";
import PlacesPanel from "@/components/PlacesPanel";
import VisitSuggestionsPanel from "@/components/VisitSuggestionsPanel";
import UnknownVisitSuggestionsPanel from "@/components/UnknownVisitSuggestionsPanel";
import SettingsPanel from "@/components/SettingsPanel";
import AsideHeader from "@/components/AsideHeader";
import ConflictsPanel from "@/components/ConflictsPanel";
import { DeviceFilterProvider } from "@/components/DeviceFilterProvider";
import IconBadge from "@/components/IconBadge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getRangeBounds } from "@/lib/getRangeBounds";
import { useSuggestionCounts } from "@/hooks/useSuggestionCounts";
import type { RangeType } from "@/app/timeline/[date]/page";

const VALID_RANGES: RangeType[] = ["day", "week", "month", "year", "custom", "all"];

type SidebarTab = "timeline" | "places" | "suggestions" | "unknown" | "settings" | "devices";

function TimelineIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={className}>
      <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-13a.75.75 0 0 0-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 0 0 0-1.5h-3.25V5Z" clipRule="evenodd" />
    </svg>
  );
}

function PlacesIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={className}>
      <path fillRule="evenodd" d="m9.69 18.933.003.001C9.89 19.02 10 19 10 19s.11.02.308-.066l.002-.001.006-.003.018-.008a5.741 5.741 0 0 0 .281-.14c.186-.096.446-.24.757-.433.62-.384 1.445-.966 2.274-1.765C14.925 15.337 16.5 13.09 16.5 10c0-3.584-2.916-6.5-6.5-6.5S3.5 6.416 3.5 10c0 3.09 1.575 5.337 2.854 6.584.83.8 1.654 1.381 2.274 1.765.311.193.571.337.757.433a5.68 5.68 0 0 0 .281.14l.018.008.006.003ZM10 11.25a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5Z" clipRule="evenodd" />
    </svg>
  );
}

function SuggestionsIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={className}>
      <path d="M10 1a6 6 0 0 0-3.815 10.631C7.237 12.5 8 13.443 8 14.456v.644a.75.75 0 0 0 .572.729 6.016 6.016 0 0 0 2.856 0A.75.75 0 0 0 12 15.1v-.644c0-1.013.762-1.957 1.815-2.825A6 6 0 0 0 10 1ZM8.863 17.414a.75.75 0 0 0-.226 1.483 9.066 9.066 0 0 0 2.726 0 .75.75 0 0 0-.226-1.483 7.553 7.553 0 0 1-2.274 0Z" />
    </svg>
  );
}

function UnknownIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={className}>
      <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0ZM8.94 6.94a.75.75 0 1 1-1.061-1.061 3 3 0 1 1 2.871 5.026v.345a.75.75 0 0 1-1.5 0v-.5c0-.72.57-1.172 1.081-1.287A1.5 1.5 0 1 0 8.94 6.94ZM10 15a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
    </svg>
  );
}

function DevicesIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={className}>
      <path fillRule="evenodd" d="M2 4.25A2.25 2.25 0 0 1 4.25 2h11.5A2.25 2.25 0 0 1 18 4.25v8.5A2.25 2.25 0 0 1 15.75 15h-3.105a3.501 3.501 0 0 0 1.1 1.677A.75.75 0 0 1 13.26 18H6.74a.75.75 0 0 1-.484-1.323A3.501 3.501 0 0 0 7.355 15H4.25A2.25 2.25 0 0 1 2 12.75v-8.5Zm1.5 0a.75.75 0 0 1 .75-.75h11.5a.75.75 0 0 1 .75.75v7.5a.75.75 0 0 1-.75.75H4.25a.75.75 0 0 1-.75-.75v-7.5Z" clipRule="evenodd" />
    </svg>
  );
}

function SettingsIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={className}>
      <path fillRule="evenodd" d="M7.84 1.804A1 1 0 0 1 8.82 1h2.36a1 1 0 0 1 .98.804l.223 1.164a6.98 6.98 0 0 1 1.48.85l1.08-.54a1 1 0 0 1 1.232.236l1.668 1.668a1 1 0 0 1 .236 1.232l-.54 1.08c.332.46.616.958.85 1.48l1.164.223a1 1 0 0 1 .804.98v2.36a1 1 0 0 1-.804.98l-1.164.223a6.98 6.98 0 0 1-.85 1.48l.54 1.08a1 1 0 0 1-.236 1.232l-1.668 1.668a1 1 0 0 1-1.232.236l-1.08-.54a6.98 6.98 0 0 1-1.48.85l-.223 1.164a1 1 0 0 1-.98.804H8.82a1 1 0 0 1-.98-.804l-.223-1.164a6.98 6.98 0 0 1-1.48-.85l-1.08.54a1 1 0 0 1-1.232-.236L2.157 16.61a1 1 0 0 1-.236-1.232l.54-1.08a6.98 6.98 0 0 1-.85-1.48l-1.164-.223A1 1 0 0 1 .643 11.615v-2.36a1 1 0 0 1 .804-.98l1.164-.223a6.98 6.98 0 0 1 .85-1.48l-.54-1.08a1 1 0 0 1 .236-1.232L4.825 2.592a1 1 0 0 1 1.232-.236l1.08.54c.46-.332.958-.616 1.48-.85l.223-1.164ZM10 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" clipRule="evenodd" />
    </svg>
  );
}

const TABS: { id: SidebarTab; label: string; Icon: React.FC<{ className?: string }> }[] = [
  { id: "timeline", label: "Timeline", Icon: TimelineIcon },
  { id: "places", label: "Places", Icon: PlacesIcon },
  { id: "suggestions", label: "Suggestions", Icon: SuggestionsIcon },
  { id: "unknown", label: "Unknown Places", Icon: UnknownIcon },
  { id: "devices", label: "Device Filters", Icon: DevicesIcon },
];

function ActivityBar({
  activeTab,
  onTabChange,
  onSettingsClick,
  suggestionsCount,
  unknownCount,
}: {
  activeTab: SidebarTab | null;
  onTabChange: (tab: SidebarTab) => void;
  onSettingsClick: () => void;
  suggestionsCount: number;
  unknownCount: number;
}) {
  return (
    <div className="flex h-full w-14 shrink-0 flex-col items-center gap-1 border-r bg-muted/50 py-2">
      {TABS.map(({ id, label, Icon }) => (
        <Tooltip key={id}>
          <TooltipTrigger
            onClick={() => onTabChange(id)}
            className={`relative flex h-11 w-11 items-center justify-center rounded-md transition-colors ${
              activeTab === id
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:bg-background/60 hover:text-foreground"
            }`}
            aria-label={label}
          >
            {activeTab === id && (
              <div className="absolute left-0 top-1/2 h-6 w-0.5 -translate-y-1/2 rounded-r bg-primary" />
            )}
            <Icon className="h-7 w-7" />
            {id === "suggestions" && <IconBadge count={suggestionsCount} />}
            {id === "unknown" && <IconBadge count={unknownCount} variant="warning" />}
          </TooltipTrigger>
          <TooltipContent side="right">{label}</TooltipContent>
        </Tooltip>
      ))}

      <div className="mt-auto">
        <Tooltip>
          <TooltipTrigger
            onClick={onSettingsClick}
            className="flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-background/60 hover:text-foreground"
            aria-label="Settings"
          >
            <SettingsIcon className="h-7 w-7" />
          </TooltipTrigger>
          <TooltipContent side="right">Settings</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}

function PanelContent({
  activeTab,
  rangeStart,
  rangeEnd,
  onDetect,
  detecting,
  children,
}: {
  activeTab: SidebarTab;
  rangeStart?: string;
  rangeEnd?: string;
  onDetect: () => void;
  detecting: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-full flex-1 flex-col overflow-x-hidden overflow-y-hidden">
      {activeTab === "timeline" && (
        <>
          <AsideHeader onDetect={onDetect} detecting={detecting} rangeStart={rangeStart} rangeEnd={rangeEnd} />
          {children}
        </>
      )}
      {activeTab === "places" && (
        <div className="flex h-full flex-col overflow-hidden">
          <div className="border-b px-4 py-3">
            <h2 className="text-sm font-semibold">Places</h2>
          </div>
          <div className="flex-1 overflow-y-auto overflow-x-hidden">
            <PlacesPanel />
          </div>
        </div>
      )}
      {activeTab === "suggestions" && (
        <div className="flex h-full flex-col overflow-hidden">
          <div className="border-b px-4 py-3">
            <h2 className="text-sm font-semibold">Visit Suggestions</h2>
          </div>
          <div className="flex-1 overflow-y-auto overflow-x-hidden">
            <VisitSuggestionsPanel />
          </div>
        </div>
      )}
      {activeTab === "unknown" && (
        <div className="flex h-full flex-col overflow-hidden">
          <div className="border-b px-4 py-3">
            <h2 className="text-sm font-semibold">Unknown Places</h2>
          </div>
          <div className="flex-1 overflow-y-auto overflow-x-hidden">
            <UnknownVisitSuggestionsPanel />
          </div>
        </div>
      )}
      {activeTab === "settings" && (
        <div className="flex h-full flex-col overflow-hidden">
          <div className="border-b px-4 py-3">
            <h2 className="text-sm font-semibold">Settings</h2>
          </div>
          <div className="flex-1 overflow-y-auto overflow-x-hidden">
            <SettingsPanel />
          </div>
        </div>
      )}
      {activeTab === "devices" && (
        <div className="flex h-full flex-col overflow-hidden">
          <div className="border-b px-4 py-3">
            <h2 className="text-sm font-semibold">Device Filters</h2>
          </div>
          <div className="flex-1 overflow-y-auto overflow-x-hidden">
            <ConflictsPanel />
          </div>
        </div>
      )}
    </div>
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
  const [activeTab, setActiveTab] = useState<SidebarTab | null>("timeline");
  const [mobileTab, setMobileTab] = useState<SidebarTab>("timeline");
  const [detecting, setDetecting] = useState(false);
  const { suggestions: suggestionsCount, unknown: unknownCount } = useSuggestionCounts();

  useEffect(() => {
    function handleFlyTo() {
      setMobilePanelsOpen(false);
    }
    window.addEventListener("opentimeline:fly-to", handleFlyTo);
    return () => window.removeEventListener("opentimeline:fly-to", handleFlyTo);
  }, []);

  function handleTabChange(tab: SidebarTab) {
    setActiveTab((prev) => (prev === tab ? null : tab));
  }

  function handleMobileTabChange(tab: SidebarTab) {
    setMobileTab(tab);
  }

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
      toast(
        total === 0
          ? "No new visit suggestions found"
          : `${total} new visit suggestion${total === 1 ? "" : "s"} detected`
      );
    }
  }

  return (
    <DeviceFilterProvider>
    <div className="flex h-dvh w-full overflow-hidden bg-background md:h-screen md:w-screen md:flex-row">
      {/* Mobile full-screen overlay */}
      {mobilePanelsOpen && (
        <div className="fixed inset-0 z-1100 flex flex-col bg-background md:hidden">
          <PanelContent
            activeTab={mobileTab}
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
            onDetect={detectVisits}
            detecting={detecting}
          >
            {children}
          </PanelContent>
          {/* Floating map button */}
          <Button
            size="icon"
            onClick={() => setMobilePanelsOpen(false)}
            className="absolute bottom-[calc(5rem+env(safe-area-inset-bottom))] right-4 z-10 h-14 w-14 rounded-full bg-background text-foreground shadow-lg ring-1 ring-border active:scale-95"
            aria-label="Show map"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-6 w-6">
              <path fillRule="evenodd" d="M8.157 2.176a1.5 1.5 0 0 0-1.147 0l-4.084 1.69A1.5 1.5 0 0 0 2 5.25v10.877a1.5 1.5 0 0 0 2.074 1.386l3.51-1.452 4.26 1.762a1.5 1.5 0 0 0 1.147 0l4.083-1.69A1.5 1.5 0 0 0 18 14.75V3.872a1.5 1.5 0 0 0-2.073-1.386l-3.51 1.452-4.26-1.762ZM7.58 5a.75.75 0 0 1 .75.75v6.5a.75.75 0 0 1-1.5 0v-6.5A.75.75 0 0 1 7.58 5Zm5.59 2.75a.75.75 0 0 0-1.5 0v6.5a.75.75 0 0 0 1.5 0v-6.5Z" clipRule="evenodd" />
            </svg>
          </Button>
          {/* Bottom tab bar */}
          <div className="flex shrink-0 border-t bg-muted/50 px-1 pb-[env(safe-area-inset-bottom)]">
            {[...TABS, { id: "settings" as SidebarTab, label: "Settings", Icon: SettingsIcon }].map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => handleMobileTabChange(id)}
                className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] transition-colors ${
                  mobileTab === id && id !== "settings"
                    ? "text-foreground"
                    : "text-muted-foreground"
                }`}
              >
                <span className="relative inline-flex">
                  <Icon className="h-7 w-7" />
                  {id === "suggestions" && <IconBadge count={suggestionsCount} />}
                  {id === "unknown" && <IconBadge count={unknownCount} variant="warning" />}
                </span>
                <span className="truncate">{label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Desktop: Activity Bar + Panel */}
      <div className="hidden md:flex md:h-full md:shrink-0">
        <ActivityBar
          activeTab={activeTab}
          onTabChange={handleTabChange}
          onSettingsClick={() => handleTabChange("settings")}
          suggestionsCount={suggestionsCount}
          unknownCount={unknownCount}
        />
        {activeTab !== null && (
          <div className="flex h-full w-120 max-w-[40vw] flex-col overflow-hidden border-r bg-background">
            <PanelContent
              activeTab={activeTab}
              rangeStart={rangeStart}
              rangeEnd={rangeEnd}
              onDetect={detectVisits}
              detecting={detecting}
            >
              {children}
            </PanelContent>
          </div>
        )}
      </div>

      <main className="relative min-h-0 flex-1">
        <MapWrapper rangeStart={rangeStart} rangeEnd={rangeEnd} shouldAutoFit={shouldAutoFit} />
        <Button
          size="icon"
          onClick={() => setMobilePanelsOpen((open) => !open)}
          className={`absolute bottom-[calc(1.5rem+env(safe-area-inset-bottom))] right-4 z-40 h-14 w-14 rounded-full bg-background text-foreground shadow-lg ring-1 ring-border active:scale-95 md:hidden ${mobilePanelsOpen ? "hidden" : ""}`}
          aria-label="Toggle panel"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
            <path fillRule="evenodd" d="M3 6.75A.75.75 0 0 1 3.75 6h16.5a.75.75 0 0 1 0 1.5H3.75A.75.75 0 0 1 3 6.75ZM3 12a.75.75 0 0 1 .75-.75h16.5a.75.75 0 0 1 0 1.5H3.75A.75.75 0 0 1 3 12Zm0 5.25a.75.75 0 0 1 .75-.75H12a.75.75 0 0 1 0 1.5H3.75a.75.75 0 0 1-.75-.75Z" clipRule="evenodd" />
          </svg>
        </Button>
      </main>
    </div>
    </DeviceFilterProvider>
  );
}

export default function TimelineLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense>
      <TimelineShell>{children}</TimelineShell>
    </Suspense>
  );
}
