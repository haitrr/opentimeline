import { MapPin } from "lucide-react";

export default function PlacesEmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <MapPin className="h-5 w-5 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium">No places yet</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Click anywhere on the map to drop your first place.
      </p>
    </div>
  );
}
