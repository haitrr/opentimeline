"use client";

import { useState } from "react";
import { format } from "date-fns";
import type { SerializedDeviceFilter } from "@/components/DeviceFilterProvider";
import { useDeviceFilters } from "@/components/DeviceFilterProvider";

type Props = {
  filter: SerializedDeviceFilter;
  allDeviceIds: string[];
  onClose: () => void;
};

export default function EditFilterDialog({ filter, allDeviceIds, onClose }: Props) {
  const { updateFilter } = useDeviceFilters();
  const [selectedDevices, setSelectedDevices] = useState<string[]>(filter.deviceIds);
  const [label, setLabel] = useState(filter.label ?? "");
  const [saving, setSaving] = useState(false);

  const knownDevices = [...new Set([...allDeviceIds, ...filter.deviceIds])];

  function toggleDevice(deviceId: string) {
    setSelectedDevices((prev) =>
      prev.includes(deviceId) ? prev.filter((d) => d !== deviceId) : [...prev, deviceId]
    );
  }

  async function handleSave() {
    if (selectedDevices.length === 0) return;
    setSaving(true);
    try {
      await updateFilter(filter.id, {
        fromTime: filter.fromTime,
        toTime: filter.toTime,
        deviceIds: selectedDevices,
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
            <h2 className="text-base font-semibold text-gray-900">Edit Device Filter</h2>
            <p className="mt-0.5 text-xs text-gray-500">
              {format(new Date(filter.fromTime), "MMM d, HH:mm")} –{" "}
              {format(new Date(filter.toTime), "HH:mm")}
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

        <div className="space-y-3 overflow-y-auto px-5 py-4">
          <div>
            <p className="mb-1 text-xs text-gray-500">Show data from</p>
            <div className="space-y-1.5">
              {knownDevices.map((deviceId) => (
                <label key={deviceId} className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedDevices.includes(deviceId)}
                    onChange={() => toggleDevice(deviceId)}
                    disabled={saving}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <span className="font-mono text-gray-900">{deviceId}</span>
                </label>
              ))}
            </div>
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
            className="rounded bg-orange-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-orange-600 disabled:opacity-50"
            disabled={saving || selectedDevices.length === 0}
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
