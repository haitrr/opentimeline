"use client";

import { useState } from "react";
import { format } from "date-fns";
import { useDeviceFilters } from "@/components/DeviceFilterProvider";
import ConflictResolutionDialog from "@/components/ConflictResolutionDialog";
import type { ConflictRange } from "@/lib/conflict-detection";

export default function ConflictsPanel() {
  const { filters, conflicts, deleteFilter } = useDeviceFilters();
  const [resolvingConflict, setResolvingConflict] = useState<ConflictRange | null>(null);

  const unresolvedConflicts = conflicts.filter(
    (conflict) =>
      !filters.some(
        (f) =>
          new Date(f.fromTime) <= conflict.fromTime &&
          new Date(f.toTime) >= conflict.toTime
      )
  );

  return (
    <div className="flex flex-col gap-4 p-4">
      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
          Unresolved Conflicts
        </h3>
        {unresolvedConflicts.length === 0 ? (
          <p className="text-xs text-gray-400">No conflicts detected for the current view.</p>
        ) : (
          <ul className="space-y-2">
            {unresolvedConflicts.map((conflict, i) => (
              <li key={i} className="rounded border border-orange-200 bg-orange-50 p-3">
                <p className="text-xs font-medium text-orange-800">
                  {format(conflict.fromTime, "MMM d, HH:mm")} –{" "}
                  {format(conflict.toTime, "HH:mm")}
                </p>
                <p className="mt-0.5 text-xs text-orange-600">
                  Devices: {conflict.deviceIds.join(", ")}
                </p>
                <button
                  onClick={() => setResolvingConflict(conflict)}
                  className="mt-2 rounded bg-orange-500 px-2 py-1 text-xs font-medium text-white hover:bg-orange-600"
                >
                  Resolve
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
          Active Filters
        </h3>
        {filters.length === 0 ? (
          <p className="text-xs text-gray-400">No filters saved.</p>
        ) : (
          <ul className="space-y-2">
            {filters.map((filter) => (
              <li key={filter.id} className="rounded border border-gray-200 bg-gray-50 p-3">
                {filter.label && (
                  <p className="mb-0.5 text-xs font-medium text-gray-800">{filter.label}</p>
                )}
                <p className="text-xs text-gray-600">
                  {format(new Date(filter.fromTime), "MMM d, HH:mm")} –{" "}
                  {format(new Date(filter.toTime), "HH:mm")}
                </p>
                <p className="mt-0.5 text-xs text-gray-500">
                  Showing: {filter.deviceIds.join(", ")}
                </p>
                <button
                  onClick={() => deleteFilter(filter.id)}
                  className="mt-2 rounded border border-red-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {resolvingConflict && (
        <ConflictResolutionDialog
          conflict={resolvingConflict}
          onClose={() => setResolvingConflict(null)}
        />
      )}
    </div>
  );
}
