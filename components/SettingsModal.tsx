"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

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

type Tab = "visit-detection";

type Props = {
  onClose: () => void;
};

export default function SettingsModal({ onClose }: Props) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>("visit-detection");
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
    <div
      className="fixed inset-0 z-1000 flex items-end justify-center bg-black/40 p-2 sm:items-center sm:p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="flex w-full max-w-xl overflow-hidden rounded-lg bg-white shadow-xl">
        {/* Tab sidebar */}
        <nav className="flex w-40 shrink-0 flex-col border-r border-gray-200 bg-gray-50 p-2">
          <p className="mb-2 px-2 pt-1 text-xs font-semibold uppercase tracking-wider text-gray-400">
            Settings
          </p>
          <button
            type="button"
            onClick={() => setActiveTab("visit-detection")}
            className={`rounded px-2 py-1.5 text-left text-sm transition-colors ${
              activeTab === "visit-detection"
                ? "bg-white font-medium text-gray-900 shadow-sm"
                : "text-gray-600 hover:bg-gray-100 hover:text-gray-800"
            }`}
          >
            Visit detection
          </button>
        </nav>

        {/* Content */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
            <h2 className="text-sm font-semibold text-gray-900">Visit detection</h2>
            <button
              type="button"
              onClick={onClose}
              className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              aria-label="Close settings"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
              </svg>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4">
            {isLoading ? (
              <p className="text-xs text-gray-400">Loading…</p>
            ) : (
              <div className="space-y-6">
                {/* Known visits section */}
                <div>
                  <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
                    Known places
                  </h3>
                  <div className="space-y-4">
                    <Field
                      label="Time gap to split sessions"
                      hint="A gap longer than this between location points splits a visit into two separate sessions."
                      value={currentSessionGap}
                      unit="minutes"
                      onChange={(v) => setSessionGap(v)}
                    />
                    <Field
                      label="Minimum dwell time"
                      hint="Sessions shorter than this are discarded and not counted as visits."
                      value={currentMinDwell}
                      unit="minutes"
                      onChange={(v) => setMinDwell(v)}
                    />
                    <Field
                      label="Post-departure evidence window"
                      hint="A point outside the place radius must appear within this window after the last recorded point to confirm departure."
                      value={currentPostDeparture}
                      unit="minutes"
                      onChange={(v) => setPostDeparture(v)}
                    />
                  </div>
                </div>

                <div className="border-t border-gray-100" />

                {/* Unknown visits section */}
                <div>
                  <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
                    Unknown places
                  </h3>
                  <div className="space-y-4">
                    <Field
                      label="Cluster radius"
                      hint="Location points within this radius of a cluster's center are grouped into the same cluster."
                      value={currentUnknownClusterRadius}
                      unit="meters"
                      min={1}
                      max={500}
                      onChange={(v) => setUnknownClusterRadius(v)}
                    />
                    <Field
                      label="Time gap to split clusters"
                      hint="A gap longer than this between consecutive points splits a cluster into two separate visits."
                      value={currentUnknownSessionGap}
                      unit="minutes"
                      onChange={(v) => setUnknownSessionGap(v)}
                    />
                    <Field
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
          </div>

          <div className="flex items-center justify-between border-t border-gray-200 px-5 py-3">
            <button
              type="button"
              onClick={handleReset}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              Reset to defaults
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded border border-gray-300 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={mutation.isPending || isLoading}
                className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {saved ? "Saved!" : mutation.isPending ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  value,
  unit,
  min = 1,
  max = 120,
  onChange,
}: {
  label: string;
  hint: string;
  value: number;
  unit: string;
  min?: number;
  max?: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-700">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(Math.max(min, Number(e.target.value)))}
          min={min}
          max={max}
          className="w-24 rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
        />
        <span className="text-sm text-gray-500">{unit}</span>
      </div>
      <p className="mt-1 text-xs text-gray-400">{hint}</p>
    </div>
  );
}
