"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Props = {
  placeName: string;
  lat: number;
  lon: number;
  error: string | null;
  updating: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function PlaceMoveConfirmDialog({
  placeName, lat, lon, error, updating, onConfirm, onCancel,
}: Props) {
  return (
    <AlertDialog open>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Update place location?</AlertDialogTitle>
          <AlertDialogDescription>
            Move <span className="font-medium text-foreground">{placeName}</span> to this location?
            <br />
            <span className="text-xs">{lat.toFixed(5)}, {lon.toFixed(5)}</span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel} disabled={updating}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={updating}>
            {updating ? "Updating…" : "Update location"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
