"use client";

import React from "react";
import { Marker, Popup } from "react-map-gl/maplibre";
import { format } from "date-fns";
import type { ImmichPhoto } from "@/lib/immich";
import type { PopupState } from "@/components/map/mapConstants";

type Props = {
  popup: PopupState;
  onClosePopup: () => void;
  unknownVisitPopupPhotos: ImmichPhoto[];
  onPhotoClick?: (photo: ImmichPhoto, list?: ImmichPhoto[]) => void;
  onUnknownVisitCreatePlace?: (uv: NonNullable<Extract<PopupState, { kind: "unknownVisit" }>["uv"]>) => void;
  allPhotos: ImmichPhoto[];
  playPos: { lat: number; lon: number } | null;
  playTimestamp: number | null;
  playTimestampFmt: string;
};

export default function MapPopups({
  popup,
  onClosePopup,
  unknownVisitPopupPhotos,
  onPhotoClick,
  onUnknownVisitCreatePlace,
  allPhotos,
  playPos,
  playTimestamp,
  playTimestampFmt,
}: Props) {
  return (
    <>
      {/* Journey playback marker */}
      {playPos && (
        <Marker latitude={playPos.lat} longitude={playPos.lon} anchor="bottom">
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            {playTimestamp != null && (
              <div style={{
                background: "rgba(0,0,0,0.72)",
                color: "#fff",
                fontSize: 11,
                fontWeight: 600,
                padding: "2px 7px",
                borderRadius: 99,
                whiteSpace: "nowrap",
                boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
                letterSpacing: 0.2,
              }}>
                {format(new Date(playTimestamp * 1000), playTimestampFmt)}
              </div>
            )}
            <div
              style={{
                width: 34,
                height: 34,
                background: "#ef4444",
                borderRadius: "50% 50% 50% 0",
                transform: "rotate(-45deg)",
                border: "2.5px solid white",
                boxShadow: "0 2px 8px rgba(0,0,0,0.45)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span style={{ transform: "rotate(45deg)", fontSize: 17, lineHeight: 1 }}>🚶</span>
            </div>
          </div>
        </Marker>
      )}

      {/* Point popup */}
      {popup?.kind === "point" && (
        <Popup latitude={popup.lat} longitude={popup.lon} onClose={onClosePopup} closeButton anchor="bottom">
          <div className="text-xs">
            <p className="font-semibold">
              {format(new Date(popup.point.recordedAt), "MMM d, yyyy, HH:mm:ss")}
            </p>
            {popup.point.acc != null && (
              <p className="text-gray-500">±{Math.round(popup.point.acc)}m</p>
            )}
            {popup.point.batt != null && (
              <p className="text-gray-500">Battery: {popup.point.batt}%</p>
            )}
            {popup.point.vel != null && popup.point.vel > 0 && (
              <p className="text-gray-500">{Math.round(popup.point.vel)} km/h</p>
            )}
            {popup.point.deviceId != null && (
              <p className="text-gray-500">Device: {popup.point.deviceId}</p>
            )}
            <p className="mt-1 text-gray-400">
              {popup.lat.toFixed(5)}, {popup.lon.toFixed(5)}
            </p>
          </div>
        </Popup>
      )}

      {/* Unknown visit popup */}
      {popup?.kind === "unknownVisit" && (
        <Popup latitude={popup.lat} longitude={popup.lon} onClose={onClosePopup} closeButton anchor="bottom">
          <div className="text-xs" style={{ minWidth: 180, maxWidth: 260 }}>
            <p className="font-semibold text-yellow-700">Unknown</p>
            <p className="mt-0.5 text-gray-600">
              {format(new Date(popup.uv.arrivalAt), "MMM d, HH:mm")} –{" "}
              {format(new Date(popup.uv.departureAt), "HH:mm")}
            </p>
            <p className="mb-2 text-gray-400">{popup.uv.pointCount} points</p>

            {unknownVisitPopupPhotos.length > 0 && (
              <div className="mb-2">
                <p className="mb-1 text-[11px] font-medium text-gray-500">
                  Photos in this period ({unknownVisitPopupPhotos.length})
                </p>
                <div className="flex gap-1 overflow-x-auto pb-1">
                  {unknownVisitPopupPhotos.map((photo) => (
                    <button
                      key={photo.id}
                      onClick={() => {
                        onPhotoClick?.(photo, unknownVisitPopupPhotos);
                        onClosePopup();
                      }}
                      className="shrink-0"
                      style={{ border: "none", background: "none", padding: 0, cursor: "pointer" }}
                      title={format(new Date(photo.takenAt), "HH:mm")}
                      type="button"
                    >
                      <div
                        className="h-14 w-14 rounded bg-cover bg-center"
                        style={{ backgroundImage: `url(/api/immich/thumbnail?id=${photo.id})` }}
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {onUnknownVisitCreatePlace && (
              <button
                onClick={() => {
                  onUnknownVisitCreatePlace(popup.uv);
                  onClosePopup();
                }}
                className="w-full rounded bg-amber-500 px-2 py-1 text-xs font-medium text-white hover:bg-amber-600"
              >
                Create Place
              </button>
            )}
          </div>
        </Popup>
      )}

      {/* Photo popup */}
      {popup?.kind === "photo" && (
        <Popup latitude={popup.lat} longitude={popup.lon} onClose={onClosePopup} closeButton anchor="bottom" maxWidth="none">
          <div className="text-xs" style={{ minWidth: 240 }}>
            <button
              onClick={() => {
                onPhotoClick?.(popup.photo, allPhotos);
                onClosePopup();
              }}
              style={{ display: "block", padding: 0, border: "none", background: "none", cursor: "pointer" }}
            >
              <img
                src={`/api/immich/thumbnail?id=${popup.photo.id}&size=preview`}
                alt=""
                width={240}
                height={180}
                loading="lazy"
                style={{ objectFit: "cover", borderRadius: 4, marginBottom: 4 }}
              />
            </button>
            <p className="text-center text-gray-500">
              {format(new Date(popup.photo.takenAt), "HH:mm")}
            </p>
          </div>
        </Popup>
      )}
    </>
  );
}
