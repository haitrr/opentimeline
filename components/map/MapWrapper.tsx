"use client";

import dynamic from "next/dynamic";
import type { SerializedPoint } from "@/lib/groupByHour";

const LeafletMap = dynamic(() => import("@/components/map/LeafletMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-gray-100">
      <div className="text-center">
        <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4 border-blue-400 border-t-transparent" />
        <p className="text-sm text-gray-500">Loading map…</p>
      </div>
    </div>
  ),
});

export default function MapWrapper({ points }: { points: SerializedPoint[] }) {
  return (
    <div className="h-full w-full">
      <LeafletMap points={points} />
    </div>
  );
}
