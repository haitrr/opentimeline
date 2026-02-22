import { format } from "date-fns";
import type { TimeGroup, SerializedPoint } from "@/lib/groupByHour";

function TimelineItem({ point }: { point: SerializedPoint }) {
  return (
    <div className="flex items-start gap-2 py-2 pl-6 text-xs text-gray-600 transition-colors hover:bg-gray-50">
      <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-blue-400" />
      <div>
        <p className="font-medium text-gray-800">
          {format(new Date(point.recordedAt), "HH:mm")}
        </p>
        {point.acc != null && (
          <p className="text-gray-400">±{Math.round(point.acc)}m accuracy</p>
        )}
        {point.vel != null && point.vel > 0 && (
          <p className="text-gray-400">{Math.round(point.vel)} km/h</p>
        )}
      </div>
    </div>
  );
}

export default function TimelineSidebar({ groups }: { groups: TimeGroup[] }) {
  if (groups.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-6 text-center">
        <div>
          <p className="text-sm text-gray-400">
            No location data for this period.
          </p>
          <p className="mt-1 text-xs text-gray-300">
            Make sure OwnTracks is configured to send data to this server.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {groups.map((group) => (
        <div key={group.key}>
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-gray-50 px-4 py-2">
            <span className="text-xs font-semibold text-gray-600">
              {group.label}
            </span>
            <span className="text-xs text-gray-400">
              {group.points.length} pts · {group.distanceKm.toFixed(2)} km
            </span>
          </div>
          {group.points.map((p) => (
            <TimelineItem key={p.id} point={p} />
          ))}
        </div>
      ))}
    </div>
  );
}
