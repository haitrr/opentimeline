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
  lat: number;
  lon: number;
  error: string | null;
  updating: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function PointMoveConfirmDialog({ lat, lon, error, updating, onConfirm, onCancel }: Props) {
  return (
    <AlertDialog open>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Move point to new location?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently update the GPS coordinates. This cannot be undone.
            <br />
            <span className="text-xs">{lat.toFixed(5)}, {lon.toFixed(5)}</span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel} disabled={updating}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={updating}>
            {updating ? "Moving…" : "Move point"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
