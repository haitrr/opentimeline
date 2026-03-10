"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import type { PlaceData } from "@/lib/detectVisits";

type Props = {
  placeInfo: PlaceData;
  onClose: () => void;
  onPlaceUpdated: (updated: PlaceData) => void;
  onPlaceDeleted: () => void;
};

export default function PlaceDetailHeader({ placeInfo, onClose, onPlaceUpdated, onPlaceDeleted }: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [nameInput, setNameInput] = useState(placeInfo.name);
  const [radiusInput, setRadiusInput] = useState(placeInfo.radius);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [togglingActive, setTogglingActive] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  async function handleSave() {
    const trimmedName = nameInput.trim();
    if (!trimmedName) { setEditError("Name is required"); return; }
    if (!Number.isFinite(radiusInput) || radiusInput <= 0) { setEditError("Radius must be a positive number"); return; }

    setSaving(true);
    setEditError(null);
    try {
      const res = await fetch(`/api/places/${placeInfo.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmedName, radius: radiusInput }),
      });
      if (!res.ok) {
        const data = await res.json();
        setEditError(data.error ?? "Failed to update place");
        return;
      }
      const { place: updated } = await res.json();
      setNameInput(updated.name);
      setRadiusInput(updated.radius);
      setEditing(false);
      queryClient.invalidateQueries({ queryKey: ["places"] });
      router.refresh();
      onPlaceUpdated(updated);
    } catch {
      setEditError("Network error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Delete place "${placeInfo.name}"? This action cannot be undone.`)) return;
    setDeleting(true);
    setEditError(null);
    try {
      const res = await fetch(`/api/places/${placeInfo.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        setEditError(data.error ?? "Failed to delete place");
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["places"] });
      router.refresh();
      onPlaceDeleted();
    } catch {
      setEditError("Network error");
    } finally {
      setDeleting(false);
    }
  }

  async function handleToggleActive() {
    setTogglingActive(true);
    try {
      const res = await fetch(`/api/places/${placeInfo.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !placeInfo.isActive }),
      });
      if (!res.ok) return;
      const { place: updated } = await res.json();
      queryClient.invalidateQueries({ queryKey: ["places"] });
      onPlaceUpdated(updated);
    } finally {
      setTogglingActive(false);
    }
  }

  return (
    <div className="flex items-start justify-between gap-3 border-b border-gray-200 px-4 py-4 sm:px-5">
      <div>
        {editing ? (
          <div className="space-y-2">
            <input
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              className="w-full rounded border border-gray-300 px-2 py-1 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
              autoFocus
            />
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500">Radius (m)</label>
              <input
                type="number"
                value={radiusInput}
                onChange={(e) => setRadiusInput(Number(e.target.value))}
                min={1}
                className="w-24 rounded border border-gray-300 px-2 py-1 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-gray-900">{placeInfo.name}</h2>
              {!placeInfo.isActive && (
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">Inactive</span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-gray-400">
              Radius: {placeInfo.radius}m &middot; {placeInfo.lat.toFixed(5)}, {placeInfo.lon.toFixed(5)}
            </p>
          </>
        )}
        {editError && <p className="mt-1 text-xs text-red-600">{editError}</p>}
      </div>

      <div className="ml-2 flex shrink-0 flex-wrap items-center justify-end gap-1.5 sm:ml-4">
        {editing ? (
          <>
            <button
              onClick={handleSave}
              className="rounded bg-blue-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              disabled={saving || deleting || !nameInput.trim()}
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              onClick={handleDelete}
              className="rounded border border-red-300 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
              disabled={saving || deleting}
            >
              {deleting ? "Deleting…" : "Delete"}
            </button>
            <button
              onClick={() => { setEditing(false); setNameInput(placeInfo.name); setRadiusInput(placeInfo.radius); setEditError(null); }}
              className="rounded border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100"
              disabled={saving || deleting}
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <button
              onClick={handleToggleActive}
              disabled={togglingActive}
              className={`rounded border px-2.5 py-1 text-xs font-medium disabled:opacity-50 ${
                placeInfo.isActive
                  ? "border-gray-300 text-gray-600 hover:bg-gray-100"
                  : "border-green-300 text-green-700 hover:bg-green-50"
              }`}
            >
              {placeInfo.isActive ? "Deactivate" : "Activate"}
            </button>
            <button
              onClick={() => setEditing(true)}
              className="rounded border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100"
            >
              Edit
            </button>
          </>
        )}
        <button
          onClick={onClose}
          className="flex h-6 w-6 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
