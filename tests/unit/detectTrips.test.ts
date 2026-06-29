import { describe, it, expect } from "vitest";
import {
  computeDailyCentroids,
  clusterConsecutiveDays,
  filterTripClusters,
} from "@/lib/detectTrips";

function pt(dateStr: string, lat: number, lon: number) {
  return { lat, lon, recordedAt: new Date(`${dateStr}T12:00:00Z`) };
}

describe("computeDailyCentroids", () => {
  it("averages multiple points per day", () => {
    const pts = [
      pt("2024-12-23", 37.7, -122.4),
      pt("2024-12-23", 37.8, -122.5),
      pt("2024-12-24", 37.9, -122.6),
    ];
    const centroids = computeDailyCentroids(pts);
    expect(centroids).toHaveLength(2);
    expect(centroids[0].date).toBe("2024-12-23");
    expect(centroids[0].lat).toBeCloseTo(37.75);
    expect(centroids[0].lon).toBeCloseTo(-122.45);
  });

  it("returns centroids sorted by date ascending", () => {
    const pts = [pt("2024-12-25", 37.7, -122.4), pt("2024-12-23", 37.8, -122.5)];
    const centroids = computeDailyCentroids(pts);
    expect(centroids[0].date).toBe("2024-12-23");
    expect(centroids[1].date).toBe("2024-12-25");
  });

  it("returns empty array for empty input", () => {
    expect(computeDailyCentroids([])).toEqual([]);
  });
});

describe("clusterConsecutiveDays", () => {
  it("groups consecutive nearby days into one cluster", () => {
    // SF coordinates — all within 50km of each other
    const centroids = [
      { date: "2024-12-23", lat: 37.77, lon: -122.42 },
      { date: "2024-12-24", lat: 37.78, lon: -122.43 },
      { date: "2024-12-25", lat: 37.76, lon: -122.41 },
    ];
    const clusters = clusterConsecutiveDays(centroids);
    expect(clusters).toHaveLength(1);
    expect(clusters[0]).toHaveLength(3);
  });

  it("splits geographically distant days into separate clusters", () => {
    // SF then NYC — ~4000km apart
    const centroids = [
      { date: "2024-12-23", lat: 37.77, lon: -122.42 },
      { date: "2024-12-24", lat: 40.71, lon: -74.01 },
    ];
    const clusters = clusterConsecutiveDays(centroids);
    expect(clusters).toHaveLength(2);
  });

  it("allows a 1-day gap (travel day) within a cluster", () => {
    // Days 23, 25 (gap of 2 days), all in SF
    const centroids = [
      { date: "2024-12-23", lat: 37.77, lon: -122.42 },
      { date: "2024-12-25", lat: 37.78, lon: -122.43 },
    ];
    const clusters = clusterConsecutiveDays(centroids);
    expect(clusters).toHaveLength(1);
  });
});

describe("filterTripClusters", () => {
  const HOME_LAT = 47.6; // Seattle-ish
  const HOME_LON = -122.3;

  it("keeps clusters far from home with enough days", () => {
    const sfCluster = [
      { date: "2024-12-23", lat: 37.77, lon: -122.42 },
      { date: "2024-12-24", lat: 37.77, lon: -122.42 },
    ];
    const result = filterTripClusters([sfCluster], HOME_LAT, HOME_LON);
    expect(result).toHaveLength(1);
  });

  it("removes clusters close to home", () => {
    const homeCluster = [
      { date: "2024-12-23", lat: 47.61, lon: -122.31 },
      { date: "2024-12-24", lat: 47.60, lon: -122.30 },
    ];
    const result = filterTripClusters([homeCluster], HOME_LAT, HOME_LON);
    expect(result).toHaveLength(0);
  });

  it("removes single-day clusters (below minDays)", () => {
    const sfCluster = [{ date: "2024-12-23", lat: 37.77, lon: -122.42 }];
    const result = filterTripClusters([sfCluster], HOME_LAT, HOME_LON);
    expect(result).toHaveLength(0);
  });
});
