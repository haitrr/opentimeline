"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useDeviceFilters } from "@/components/DeviceFilterProvider";
import TimeRangeSlider from "@/components/TimeRangeSlider";
import FilterPreviewMap from "@/components/FilterPreviewMap";
import type { SerializedPoint } from "@/lib/groupByHour";

type LocationsResponse = {
  points: SerializedPoint[];
};

type Props = {
  rangeStart: string;
  rangeEnd: string;
  onClose: () => void;
};

export default function CreateFilterDialog({ rangeStart, rangeEnd, onClose }: Props) {
  const { createFilter } = useDeviceFilters();

  const [fromTime, setFromTime] = useState(rangeStart);
  const [toTime, setToTime] = useState(rangeEnd);
  const [debouncedFrom, setDebouncedFrom] = useState(rangeStart);
  const [debouncedTo, setDebouncedTo] = useState(rangeEnd);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<string[]>([]);
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedFrom(fromTime);
      setDebouncedTo(toTime);
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [fromTime, toTime]);

  const { data: locationsData } = useQuery<LocationsResponse>({
    queryKey: ["filter-preview-locations", debouncedFrom, debouncedTo],
    queryFn: async () => {
      const params = new URLSearchParams({
        start: debouncedFrom,
        end: debouncedTo,
        minLat: "-90",
        maxLat: "90",
        minLon: "-180",
        maxLon: "180",
        skipBoundsIfSmall: "true",
      });
      const res = await fetch(`/api/locations?${params}`);
      if (!res.ok) return { points: [] };
      return res.json();
    },
  });

  const allPoints = locationsData?.points ?? [];
  const availableDeviceIds = useMemo(
    () =>
      [...new Set(allPoints.map((p) => p.deviceId).filter(Boolean))] as string[],
    [allPoints],
  );

  // Auto-select all devices whenever the available set changes
  useEffect(() => {
    setSelectedDeviceIds(availableDeviceIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableDeviceIds.join(",")]);

  const previewPoints = useMemo(
    () =>
      selectedDeviceIds.length > 0
        ? allPoints.filter((p) => p.deviceId && selectedDeviceIds.includes(p.deviceId))
        : [],
    [allPoints, selectedDeviceIds],
  );

  function toggleDevice(deviceId: string) {
    setSelectedDeviceIds((prev) =>
      prev.includes(deviceId)
        ? prev.filter((d) => d !== deviceId)
        : [...prev, deviceId],
    );
  }

  async function handleSave() {
    if (selectedDeviceIds.length === 0) return;
    setSaving(true);
    try {
      await createFilter({
        fromTime,
        toTime,
        deviceIds: selectedDeviceIds,
        label: label || undefined,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[1000] flex items-end justify-center bg-black/40 p-2 sm:items-center sm:p-4">
      <div className="max-h-[90vh] w-full overflow-hidden rounded-lg bg-white shadow-xl sm:max-w-md">
        <div className="flex items-start justify-between border-b border-gray-200 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Create Device Filter</h2>
            <p className="mt-0.5 text-xs text-gray-500">
              Select a time range and which devices to show
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            disabled={saving}
          >
            ✕
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto px-5 py-4">
          <div>
            <p className="mb-2 text-xs text-gray-500">Time range</p>
            <TimeRangeSlider
              min={rangeStart}
              max={rangeEnd}
              value={[fromTime, toTime]}
              onChange={(from, to) => {
                setFromTime(from);
                setToTime(to);
              }}
            />
          </div>

          <FilterPreviewMap
            points={previewPoints}
            className="overflow-hidden rounded border border-gray-200"
          />

          <div>
            <p className="mb-1.5 text-xs text-gray-500">Show data from</p>
            {availableDeviceIds.length === 0 ? (
              <p className="text-xs text-gray-400">No devices found in this time range.</p>
            ) : (
              <div className="space-y-1.5">
                {availableDeviceIds.map((deviceId) => (
                  <label
                    key={deviceId}
                    className="flex cursor-pointer items-center gap-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={selectedDeviceIds.includes(deviceId)}
                      onChange={() => toggleDevice(deviceId)}
                      disabled={saving}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <span className="font-mono text-gray-900">{deviceId}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs text-gray-500">Label (optional)</label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Left phone at home"
              className="w-full rounded border border-gray-300 px-2 py-1.5 text-gray-900 focus:border-blue-500 focus:outline-none"
              style={{ fontSize: "16px" }}
              disabled={saving}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-200 px-5 py-3">
          <button
            onClick={onClose}
            className="rounded border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-50"
            disabled={saving}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="rounded bg-blue-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-600 disabled:opacity-50"
            disabled={saving || selectedDeviceIds.length === 0}
          >
            {saving ? "Saving…" : "Save filter"}
          </button>
        </div>
      </div>
    </div>
  );
}
