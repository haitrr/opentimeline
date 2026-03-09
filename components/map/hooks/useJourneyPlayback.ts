"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SerializedPoint } from "@/lib/groupByHour";
import { haversineKm } from "@/lib/geo";
import { PLAY_DURATION_PER_DAY_MS } from "@/components/map/mapConstants";

export type JourneyPlayback = {
  isPlaying: boolean;
  playPos: { lat: number; lon: number } | null;
  playProgress: number;
  playTimestamp: number | null;
  startPlay: () => void;
  stopPlay: () => void;
};

export function useJourneyPlayback(
  points: SerializedPoint[],
  rangeKey: string | undefined
): JourneyPlayback {
  const [isPlaying, setIsPlaying] = useState(false);
  const [playPos, setPlayPos] = useState<{ lat: number; lon: number } | null>(null);
  const [playProgress, setPlayProgress] = useState(0);
  const [playTimestamp, setPlayTimestamp] = useState<number | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const playStartTimeRef = useRef<number | null>(null);

  const stopPlay = useCallback(() => {
    if (animFrameRef.current != null) cancelAnimationFrame(animFrameRef.current);
    animFrameRef.current = null;
    playStartTimeRef.current = null;
    setIsPlaying(false);
    setPlayPos(null);
    setPlayProgress(0);
    setPlayTimestamp(null);
  }, []);

  const startPlay = useCallback(() => {
    if (points.length < 2) return;
    stopPlay();
    setIsPlaying(true);
    playStartTimeRef.current = null;

    // Subsample: only keep points where the person moved >= MOVE_THRESHOLD_M.
    const MOVE_THRESHOLD_M = 15;
    const keyPts: { lat: number; lon: number; tst: number }[] = [
      { lat: points[0].lat, lon: points[0].lon, tst: points[0].tst },
    ];
    for (let k = 1; k < points.length; k++) {
      const last = keyPts[keyPts.length - 1];
      const distM = haversineKm(last.lat, last.lon, points[k].lat, points[k].lon) * 1000;
      if (distM >= MOVE_THRESHOLD_M) keyPts.push({ lat: points[k].lat, lon: points[k].lon, tst: points[k].tst });
    }
    const last = points[points.length - 1];
    if (keyPts[keyPts.length - 1].lat !== last.lat || keyPts[keyPts.length - 1].lon !== last.lon) {
      keyPts.push({ lat: last.lat, lon: last.lon, tst: last.tst });
    }

    const journeyDays = (points[points.length - 1].tst - points[0].tst) / 86400;
    const PLAY_DURATION_MS = Math.min(
      Math.max(journeyDays, 1) * PLAY_DURATION_PER_DAY_MS,
      5 * 60 * 1000,
    );

    const animate = (now: number) => {
      if (playStartTimeRef.current == null) playStartTimeRef.current = now;
      const elapsed = now - playStartTimeRef.current;
      const t = Math.min(1, elapsed / PLAY_DURATION_MS);
      const floatIndex = t * (keyPts.length - 1);
      const i = Math.min(Math.floor(floatIndex), keyPts.length - 2);
      const f = floatIndex - i;
      const lat = keyPts[i].lat + f * (keyPts[i + 1].lat - keyPts[i].lat);
      const lon = keyPts[i].lon + f * (keyPts[i + 1].lon - keyPts[i].lon);
      const tst = keyPts[i].tst + f * (keyPts[i + 1].tst - keyPts[i].tst);
      setPlayPos({ lat, lon });
      setPlayProgress(t);
      setPlayTimestamp(tst);

      if (t < 1) {
        animFrameRef.current = requestAnimationFrame(animate);
      } else {
        animFrameRef.current = null;
        setIsPlaying(false);
        setPlayPos(null);
        setPlayProgress(0);
        setPlayTimestamp(null);
      }
    };

    animFrameRef.current = requestAnimationFrame(animate);
  }, [points, stopPlay]);

  // Stop playback when points change (new day selected)
  useEffect(() => {
    if (animFrameRef.current != null) cancelAnimationFrame(animFrameRef.current);
    animFrameRef.current = null;
    playStartTimeRef.current = null;
    setIsPlaying(false);
    setPlayPos(null);
    setPlayProgress(0);
    setPlayTimestamp(null);
  }, [rangeKey]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animFrameRef.current != null) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  return { isPlaying, playPos, playProgress, playTimestamp, startPlay, stopPlay };
}
