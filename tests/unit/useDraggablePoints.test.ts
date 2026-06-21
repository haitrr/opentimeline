import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDraggablePoints } from "@/components/map/hooks/useDraggablePoints";
import type { MapRef } from "react-map-gl/maplibre";

function makeMockMap(features: object[] = []) {
  return {
    dragPan: { disable: vi.fn(), enable: vi.fn() },
    setFeatureState: vi.fn(),
    queryRenderedFeatures: vi.fn(() => features),
  } as unknown as MapRef;
}

describe("useDraggablePoints", () => {
  it("starts with hoveredPoint null", () => {
    const { result } = renderHook(() => useDraggablePoints({ current: makeMockMap() }));
    expect(result.current.hoveredPoint).toBeNull();
  });

  it("onDragStart disables dragPan", () => {
    const map = makeMockMap();
    const { result } = renderHook(() => useDraggablePoints({ current: map }));
    act(() => { result.current.onDragStart(); });
    expect(map.dragPan.disable).toHaveBeenCalledOnce();
  });

  it("onDragEnd re-enables dragPan and clears hover", () => {
    const map = makeMockMap();
    const { result } = renderHook(() => useDraggablePoints({ current: map }));
    act(() => { result.current.onDragStart(); });
    act(() => { result.current.onDragEnd(); });
    expect(map.dragPan.enable).toHaveBeenCalledOnce();
    expect(result.current.hoveredPoint).toBeNull();
  });

  it("processMouseLeave clears hoveredPoint", () => {
    const map = makeMockMap();
    const { result } = renderHook(() => useDraggablePoints({ current: map }));
    act(() => { result.current.processMouseLeave(map); });
    expect(result.current.hoveredPoint).toBeNull();
  });

  it("processMouseLeave is a no-op during drag", () => {
    const map = makeMockMap();
    const { result } = renderHook(() => useDraggablePoints({ current: map }));
    act(() => { result.current.onDragStart(); });
    act(() => { result.current.processMouseLeave(map); });
    expect(map.setFeatureState).not.toHaveBeenCalled();
  });

  it("processMouseMove returns null when isActive is false", () => {
    const map = makeMockMap();
    const { result } = renderHook(() => useDraggablePoints({ current: map }));
    let cursor: string | null;
    act(() => { cursor = result.current.processMouseMove([100, 100], map, false); });
    expect(cursor!).toBeNull();
    expect(map.queryRenderedFeatures).not.toHaveBeenCalled();
  });

  it("processMouseMove returns 'grab' and sets hoveredPoint when over a point", () => {
    const map = makeMockMap([
      {
        id: 123,
        layer: { id: "location-points" },
        properties: { id: 42 },
        geometry: { type: "Point", coordinates: [2.3, 48.8] },
      },
    ]);
    const { result } = renderHook(() => useDraggablePoints({ current: map }));
    let cursor: string | null;
    act(() => { cursor = result.current.processMouseMove([100, 100], map, true); });
    expect(cursor!).toBe("grab");
    expect(result.current.hoveredPoint).toEqual({ id: 42, lat: 48.8, lon: 2.3 });
    expect(map.setFeatureState).toHaveBeenCalledWith(
      { source: "points", id: 123 },
      { hover: true },
    );
  });

  it("processMouseMove returns null and clears hover when not over a point", () => {
    const map = makeMockMap([]);
    const { result } = renderHook(() => useDraggablePoints({ current: map }));
    act(() => { result.current.processMouseMove([100, 100], map, true); });
    expect(result.current.hoveredPoint).toBeNull();
  });

  it("processMouseMove returns 'grabbing' during drag", () => {
    const map = makeMockMap();
    const { result } = renderHook(() => useDraggablePoints({ current: map }));
    act(() => { result.current.onDragStart(); });
    let cursor: string | null;
    act(() => { cursor = result.current.processMouseMove([100, 100], map, true); });
    expect(cursor!).toBe("grabbing");
  });
});
