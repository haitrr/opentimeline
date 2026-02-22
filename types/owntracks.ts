export type OwnTracksPayload = {
  _type: "location" | "transition" | "lwt" | "card" | "waypoint";
  lat: number;
  lon: number;
  tst: number;
  acc?: number;
  batt?: number;
  tid?: string;
  alt?: number;
  vel?: number;
  cog?: number;
  t?: string;
  topic?: string;
};
