"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

type AppSettings = {
  sessionGapMinutes: number;
  minDwellMinutes: number;
  postDepartureMinutes: number;
  unknownClusterRadiusM: number;
  unknownSessionGapMinutes: number;
  unknownMinDwellMinutes: number;
};

const DEFAULTS: AppSettings = {
  sessionGapMinutes: 15,
  minDwellMinutes: 15,
  postDepartureMinutes: 15,
  unknownClusterRadiusM: 50,
  unknownSessionGapMinutes: 15,
  unknownMinDwellMinutes: 15,
};

type Props = {
  onClose: () => void;
};

function SettingsField({
  id,
  label,
  hint,
  value,
  unit,
  min = 1,
  max = 120,
  onChange,
}: {
  id: string;
  label: string;
  hint: string;
  value: number;
  unit: string;
  min?: number;
  max?: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <Input
          id={id}
          type="number"
          value={value}
          onChange={(e) => onChange(Math.max(min, Number(e.target.value)))}
          min={min}
          max={max}
          className="w-24"
        />
        <span className="text-sm text-muted-foreground">{unit}</span>
      </div>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

export default function SettingsModal({ onClose }: Props) {
  const queryClient = useQueryClient();
  const [saved, setSaved] = useState(false);

  const { data: settings, isLoading } = useQuery<AppSettings>({
    queryKey: ["settings"],
    queryFn: () => fetch("/api/settings").then((r) => r.json()),
  });

  const [sessionGap, setSessionGap] = useState<number | null>(null);
  const [minDwell, setMinDwell] = useState<number | null>(null);
  const [postDeparture, setPostDeparture] = useState<number | null>(null);
  const [unknownClusterRadius, setUnknownClusterRadius] = useState<number | null>(null);
  const [unknownSessionGap, setUnknownSessionGap] = useState<number | null>(null);
  const [unknownMinDwell, setUnknownMinDwell] = useState<number | null>(null);

  const cur = (local: number | null, key: keyof AppSettings) =>
    local ?? settings?.[key] ?? DEFAULTS[key];

  const currentSessionGap = cur(sessionGap, "sessionGapMinutes");
  const currentMinDwell = cur(minDwell, "minDwellMinutes");
  const currentPostDeparture = cur(postDeparture, "postDepartureMinutes");
  const currentUnknownClusterRadius = cur(unknownClusterRadius, "unknownClusterRadiusM");
  const currentUnknownSessionGap = cur(unknownSessionGap, "unknownSessionGapMinutes");
  const currentUnknownMinDwell = cur(unknownMinDwell, "unknownMinDwellMinutes");

  const mutation = useMutation({
    mutationFn: (data: AppSettings) =>
      fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then((r) => r.json()),
    onSuccess: (data) => {
      queryClient.setQueryData(["settings"], data);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    },
  });

  function handleSave() {
    mutation.mutate({
      sessionGapMinutes: currentSessionGap,
      minDwellMinutes: currentMinDwell,
      postDepartureMinutes: currentPostDeparture,
      unknownClusterRadiusM: currentUnknownClusterRadius,
      unknownSessionGapMinutes: currentUnknownSessionGap,
      unknownMinDwellMinutes: currentUnknownMinDwell,
    });
  }

  function handleReset() {
    setSessionGap(DEFAULTS.sessionGapMinutes);
    setMinDwell(DEFAULTS.minDwellMinutes);
    setPostDeparture(DEFAULTS.postDepartureMinutes);
    setUnknownClusterRadius(DEFAULTS.unknownClusterRadiusM);
    setUnknownSessionGap(DEFAULTS.unknownSessionGapMinutes);
    setUnknownMinDwell(DEFAULTS.unknownMinDwellMinutes);
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-xl">
        <Tabs defaultValue="visit-detection">
          <TabsList>
            <TabsTrigger value="visit-detection">Visit detection</TabsTrigger>
          </TabsList>
          <TabsContent value="visit-detection">
            {isLoading ? (
              <p className="text-xs text-muted-foreground">Loading…</p>
            ) : (
              <div className="space-y-6 py-2">
                <div>
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Known places
                  </p>
                  <div className="space-y-4">
                    <SettingsField
                      id="session-gap"
                      label="Time gap to split sessions"
                      hint="A gap longer than this between location points splits a visit into two separate sessions."
                      value={currentSessionGap}
                      unit="minutes"
                      onChange={(v) => setSessionGap(v)}
                    />
                    <SettingsField
                      id="min-dwell"
                      label="Minimum dwell time"
                      hint="Sessions shorter than this are discarded and not counted as visits."
                      value={currentMinDwell}
                      unit="minutes"
                      onChange={(v) => setMinDwell(v)}
                    />
                    <SettingsField
                      id="post-departure"
                      label="Post-departure evidence window"
                      hint="A point outside the place radius must appear within this window after the last recorded point to confirm departure."
                      value={currentPostDeparture}
                      unit="minutes"
                      onChange={(v) => setPostDeparture(v)}
                    />
                  </div>
                </div>

                <Separator />

                <div>
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Unknown places
                  </p>
                  <div className="space-y-4">
                    <SettingsField
                      id="unknown-cluster-radius"
                      label="Cluster radius"
                      hint="Location points within this radius of a cluster's center are grouped into the same cluster."
                      value={currentUnknownClusterRadius}
                      unit="meters"
                      min={1}
                      max={500}
                      onChange={(v) => setUnknownClusterRadius(v)}
                    />
                    <SettingsField
                      id="unknown-session-gap"
                      label="Time gap to split clusters"
                      hint="A gap longer than this between consecutive points splits a cluster into two separate visits."
                      value={currentUnknownSessionGap}
                      unit="minutes"
                      onChange={(v) => setUnknownSessionGap(v)}
                    />
                    <SettingsField
                      id="unknown-min-dwell"
                      label="Minimum dwell time"
                      hint="Clusters shorter than this are discarded and not counted as unknown visits."
                      value={currentUnknownMinDwell}
                      unit="minutes"
                      onChange={(v) => setUnknownMinDwell(v)}
                    />
                  </div>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={handleReset}>
            Reset to defaults
          </Button>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={mutation.isPending || isLoading}
          >
            {saved ? "Saved!" : mutation.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
