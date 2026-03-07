import http from "node:http";
import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { detectVisitsForAllPlaces } from "@/lib/detectVisits";
import { detectUnknownVisits } from "@/lib/detectUnknownVisits";
import { haversineKm } from "@/lib/geo";
import { getImmichPhotos, isImmichConfigured } from "@/lib/immich";

async function getSettings() {
  return prisma.appSettings.findUnique({ where: { id: 1 } });
}

// ---------------------------------------------------------------------------
// Tool registration — called once per McpServer instance
// ---------------------------------------------------------------------------
export function registerTools(server: McpServer) {
  server.registerTool(
    "trigger_visit_detection",
    {
      description: "Run visit detection against all known places. Optionally restrict to a date range.",
      inputSchema: {
        start: z.string().optional().describe("ISO 8601 start datetime (e.g. 2025-01-01T00:00:00Z)"),
        end: z.string().optional().describe("ISO 8601 end datetime"),
      },
    },
    async ({ start, end }) => {
      const settings = await getSettings();
      const newVisits = await detectVisitsForAllPlaces(
        settings?.sessionGapMinutes ?? 15,
        settings?.minDwellMinutes ?? 15,
        settings?.postDepartureMinutes ?? 15,
        start ? new Date(start) : undefined,
        end ? new Date(end) : undefined,
      );
      return { content: [{ type: "text", text: JSON.stringify({ newVisits }) }] };
    }
  );

  server.registerTool(
    "trigger_unknown_visit_detection",
    {
      description: "Run unknown-visit detection to find dwell clusters at locations not matching any known place. Optionally restrict to a date range.",
      inputSchema: {
        start: z.string().optional().describe("ISO 8601 start datetime"),
        end: z.string().optional().describe("ISO 8601 end datetime"),
      },
    },
    async ({ start, end }) => {
      const settings = await getSettings();
      const created = await detectUnknownVisits(
        start ? new Date(start) : undefined,
        end ? new Date(end) : undefined,
        settings?.unknownSessionGapMinutes ?? 15,
        settings?.unknownMinDwellMinutes ?? 15,
        settings?.unknownClusterRadiusM ?? 50,
      );
      return { content: [{ type: "text", text: JSON.stringify({ created }) }] };
    }
  );

  server.registerTool(
    "get_pending_unknown_visits",
    {
      description: "List unknown visit suggestions. Default status is 'suggested'. Optionally filter by date range.",
      inputSchema: {
        status: z.enum(["suggested", "confirmed", "rejected"]).optional().default("suggested").describe("Filter by status (default: suggested)"),
        start: z.string().optional().describe("ISO 8601 start datetime — only visits overlapping this range are returned"),
        end: z.string().optional().describe("ISO 8601 end datetime"),
        limit: z.number().int().positive().optional().default(50).describe("Max results to return (default: 50)"),
      },
    },
    async ({ status, start, end, limit }) => {
      const suggestions = await prisma.unknownVisitSuggestion.findMany({
        where: {
          status,
          ...(start || end ? {
            AND: [
              ...(end ? [{ arrivalAt: { lt: new Date(end) } }] : []),
              ...(start ? [{ departureAt: { gt: new Date(start) } }] : []),
            ],
          } : {}),
        },
        orderBy: { arrivalAt: "asc" },
        take: limit,
      });
      return {
        content: [{ type: "text", text: JSON.stringify(suggestions.map(s => ({
          ...s,
          arrivalAt: s.arrivalAt.toISOString(),
          departureAt: s.departureAt.toISOString(),
          createdAt: s.createdAt.toISOString(),
          durationMinutes: Math.round((s.departureAt.getTime() - s.arrivalAt.getTime()) / 60000),
        }))) }],
      };
    }
  );

  server.registerTool(
    "review_unknown_visit",
    {
      description: "Get full details of a specific unknown visit suggestion including coordinates, duration, nearby photos from Immich (if configured), and the nearest known places.",
      inputSchema: {
        id: z.number().int().describe("The unknown visit suggestion ID"),
      },
    },
    async ({ id }) => {
      const visit = await prisma.unknownVisitSuggestion.findUnique({ where: { id } });
      if (!visit) return { content: [{ type: "text", text: JSON.stringify({ error: "Not found" }) }] };

      const places = await prisma.place.findMany({ select: { id: true, name: true, lat: true, lon: true, radius: true } });
      const nearestKnownPlaces = places
        .map(p => ({ ...p, distanceM: Math.round(haversineKm(visit.lat, visit.lon, p.lat, p.lon) * 1000) }))
        .sort((a, b) => a.distanceM - b.distanceM)
        .slice(0, 5);

      let immichPhotos: { id: string; lat: number | null; lon: number | null; takenAt: string }[] = [];
      if (isImmichConfigured()) {
        try { immichPhotos = await getImmichPhotos(visit.arrivalAt, visit.departureAt); } catch { /* unavailable */ }
      }

      return {
        content: [{ type: "text", text: JSON.stringify({
          id: visit.id,
          status: visit.status,
          lat: visit.lat,
          lon: visit.lon,
          arrivalAt: visit.arrivalAt.toISOString(),
          departureAt: visit.departureAt.toISOString(),
          durationMinutes: Math.round((visit.departureAt.getTime() - visit.arrivalAt.getTime()) / 60000),
          pointCount: visit.pointCount,
          nearestKnownPlaces,
          immichPhotos,
          immichConfigured: isImmichConfigured(),
        }) }],
      };
    }
  );

  server.registerTool(
    "confirm_unknown_visit",
    {
      description: "Update the status of an unknown visit suggestion (confirm or reject it).",
      inputSchema: {
        id: z.number().int().describe("The unknown visit suggestion ID"),
        status: z.enum(["confirmed", "rejected"]).describe("New status to set"),
      },
    },
    async ({ id, status }) => {
      const visit = await prisma.unknownVisitSuggestion.findUnique({ where: { id } });
      if (!visit) return { content: [{ type: "text", text: JSON.stringify({ error: "Not found" }) }] };

      const updated = await prisma.unknownVisitSuggestion.update({ where: { id }, data: { status } });
      return {
        content: [{ type: "text", text: JSON.stringify({
          ...updated,
          arrivalAt: updated.arrivalAt.toISOString(),
          departureAt: updated.departureAt.toISOString(),
          createdAt: updated.createdAt.toISOString(),
        }) }],
      };
    }
  );

  server.registerTool(
    "create_place_from_unknown_visit",
    {
      description: "Create a new named place at the coordinates of an unknown visit suggestion, then run visit detection for that new place. The unknown visit suggestion is marked as confirmed.",
      inputSchema: {
        id: z.number().int().describe("The unknown visit suggestion ID"),
        name: z.string().describe("Name to give the new place"),
        radius: z.number().positive().optional().default(50).describe("Place detection radius in metres (default: 50)"),
      },
    },
    async ({ id, name, radius }) => {
      const suggestion = await prisma.unknownVisitSuggestion.findUnique({ where: { id } });
      if (!suggestion) return { content: [{ type: "text", text: JSON.stringify({ error: "Unknown visit not found" }) }] };

      const place = await prisma.place.create({ data: { name, lat: suggestion.lat, lon: suggestion.lon, radius } });

      const placeRadiusKm = place.radius / 1000;
      const unknownSuggestions = await prisma.unknownVisitSuggestion.findMany({ where: { status: "suggested" } });
      const overlapping = unknownSuggestions.filter(s => haversineKm(s.lat, s.lon, place.lat, place.lon) <= placeRadiusKm);
      if (overlapping.length > 0) {
        await prisma.unknownVisitSuggestion.updateMany({
          where: { id: { in: overlapping.map(s => s.id) } },
          data: { status: "confirmed" },
        });
      }
      await prisma.unknownVisitSuggestion.update({ where: { id }, data: { status: "confirmed" } });

      const settings = await getSettings();
      const newVisits = await detectVisitsForAllPlaces(
        settings?.sessionGapMinutes ?? 15,
        settings?.minDwellMinutes ?? 15,
        settings?.postDepartureMinutes ?? 15,
      );

      return {
        content: [{ type: "text", text: JSON.stringify({
          place: { ...place, createdAt: place.createdAt.toISOString() },
          newVisits,
          dismissedSuggestions: overlapping.length,
        }) }],
      };
    }
  );

  server.registerTool(
    "get_current_location",
    { description: "Get the most recent location point recorded for the user." },
    async () => {
      const point = await prisma.locationPoint.findFirst({
        orderBy: { recordedAt: "desc" },
        select: { id: true, lat: true, lon: true, tst: true, recordedAt: true, acc: true, alt: true, vel: true, batt: true },
      });
      if (!point) return { content: [{ type: "text", text: JSON.stringify({ location: null, message: "No location data found" }) }] };
      return { content: [{ type: "text", text: JSON.stringify({ ...point, recordedAt: point.recordedAt.toISOString() }) }] };
    }
  );

  server.registerTool(
    "get_location_history",
    {
      description: "Get location history for a specific date (YYYY-MM-DD) or a custom time range. Returns GPS points with timestamps.",
      inputSchema: {
        date: z.string().optional().describe("Date in YYYY-MM-DD format. If omitted, use start/end instead."),
        start: z.string().optional().describe("ISO 8601 start datetime (used when date is not provided)"),
        end: z.string().optional().describe("ISO 8601 end datetime (used when date is not provided)"),
        limit: z.number().int().positive().optional().default(1000).describe("Max points to return (default: 1000)"),
      },
    },
    async ({ date, start, end, limit }) => {
      let startDate: Date;
      let endDate: Date;

      if (date) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { content: [{ type: "text", text: JSON.stringify({ error: "Invalid date format. Use YYYY-MM-DD" }) }] };
        startDate = new Date(`${date}T00:00:00`);
        endDate = new Date(`${date}T23:59:59.999`);
      } else if (start && end) {
        startDate = new Date(start);
        endDate = new Date(end);
      } else {
        const today = new Date();
        startDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
      }

      const points = await prisma.locationPoint.findMany({
        where: { recordedAt: { gte: startDate, lte: endDate } },
        orderBy: { recordedAt: "asc" },
        take: limit,
        select: { id: true, lat: true, lon: true, tst: true, recordedAt: true, acc: true, alt: true, vel: true, batt: true },
      });

      return {
        content: [{ type: "text", text: JSON.stringify({
          count: points.length,
          points: points.map(p => ({ ...p, recordedAt: p.recordedAt.toISOString() })),
        }) }],
      };
    }
  );

  server.registerTool(
    "get_visits",
    {
      description: "Get visits with place details for a time range. Returns both confirmed and suggested visits by default.",
      inputSchema: {
        start: z.string().optional().describe("ISO 8601 start datetime — visits overlapping this window are returned"),
        end: z.string().optional().describe("ISO 8601 end datetime"),
        status: z.enum(["confirmed", "suggested", "all"]).optional().default("all").describe("Filter by status (default: all)"),
        date: z.string().optional().describe("Shorthand: YYYY-MM-DD date to query a full day"),
        limit: z.number().int().positive().optional().default(100).describe("Max visits to return (default: 100)"),
      },
    },
    async ({ start, end, status, date, limit }) => {
      let startDate: Date | undefined;
      let endDate: Date | undefined;

      if (date) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { content: [{ type: "text", text: JSON.stringify({ error: "Invalid date format. Use YYYY-MM-DD" }) }] };
        startDate = new Date(`${date}T00:00:00`);
        endDate = new Date(`${date}T23:59:59.999`);
      } else {
        if (start) startDate = new Date(start);
        if (end) endDate = new Date(end);
      }

      const statusFilter = status === "all" ? undefined : status;
      const visits = await prisma.visit.findMany({
        where: {
          ...(statusFilter ? { status: statusFilter } : {}),
          ...(startDate || endDate ? {
            AND: [
              ...(endDate ? [{ arrivalAt: { lt: endDate } }] : []),
              ...(startDate ? [{ departureAt: { gt: startDate } }] : []),
            ],
          } : {}),
        },
        include: { place: { select: { id: true, name: true, lat: true, lon: true, radius: true } } },
        orderBy: { arrivalAt: "asc" },
        take: limit,
      });

      return {
        content: [{ type: "text", text: JSON.stringify(visits.map(v => ({
          ...v,
          arrivalAt: v.arrivalAt.toISOString(),
          departureAt: v.departureAt.toISOString(),
          createdAt: v.createdAt.toISOString(),
          durationMinutes: Math.round((v.departureAt.getTime() - v.arrivalAt.getTime()) / 60000),
        }))) }],
      };
    }
  );

  server.registerTool(
    "get_places",
    {
      description: "List all known places with their coordinates, radius, and visit counts.",
      inputSchema: {
        active_only: z.boolean().optional().default(true).describe("If true, only return active places (default: true)"),
      },
    },
    async ({ active_only }) => {
      const places = await prisma.place.findMany({
        where: active_only ? { isActive: true } : {},
        include: { _count: { select: { visits: true } } },
        orderBy: { createdAt: "desc" },
      });
      return {
        content: [{ type: "text", text: JSON.stringify(places.map(p => ({
          id: p.id, name: p.name, lat: p.lat, lon: p.lon, radius: p.radius,
          isActive: p.isActive, createdAt: p.createdAt.toISOString(), totalVisits: p._count.visits,
        }))) }],
      };
    }
  );
}

// ---------------------------------------------------------------------------
// Transport starters
// ---------------------------------------------------------------------------
export async function startStdio() {
  const server = new McpServer({ name: "opentimeline", version: "0.1.0" });
  registerTools(server);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

export async function startHttp(listenPort: number) {
  const sessions = new Map<string, StreamableHTTPServerTransport>();

  function isInitRequest(body: unknown): boolean {
    if (!body || typeof body !== "object") return false;
    const b = body as Record<string, unknown>;
    if (b.method === "initialize") return true;
    if (Array.isArray(b)) return (b as unknown[]).some(isInitRequest);
    return false;
  }

  async function readBody(req: http.IncomingMessage): Promise<unknown> {
    return new Promise((resolve, reject) => {
      let raw = "";
      req.setEncoding("utf8");
      req.on("data", chunk => { raw += chunk; });
      req.on("end", () => { try { resolve(JSON.parse(raw)); } catch { resolve(null); } });
      req.on("error", reject);
    });
  }

  const httpServer = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://localhost:${listenPort}`);

    if (url.pathname !== "/mcp") {
      res.writeHead(404).end("Not found");
      return;
    }

    if (req.method === "POST") {
      const body = await readBody(req);
      const sessionId = req.headers["mcp-session-id"] as string | undefined;

      let transport: StreamableHTTPServerTransport;

      if (sessionId && sessions.has(sessionId)) {
        transport = sessions.get(sessionId)!;
      } else if (!sessionId && isInitRequest(body)) {
        const newSessionId = randomUUID();
        transport = new StreamableHTTPServerTransport({ sessionIdGenerator: () => newSessionId });
        const mcpServer = new McpServer({ name: "opentimeline", version: "0.1.0" });
        registerTools(mcpServer);
        await mcpServer.connect(transport);
        sessions.set(newSessionId, transport);
        transport.onclose = () => sessions.delete(newSessionId);
        await transport.handleRequest(req, res, body);
        return;
      } else {
        res.writeHead(400, { "Content-Type": "application/json" })
          .end(JSON.stringify({ error: "Bad request: missing or unknown session ID" }));
        return;
      }

      await transport.handleRequest(req, res, body);

    } else if (req.method === "GET") {
      const sessionId = req.headers["mcp-session-id"] as string | undefined;
      if (!sessionId || !sessions.has(sessionId)) {
        res.writeHead(400, { "Content-Type": "application/json" })
          .end(JSON.stringify({ error: "Missing or unknown session ID" }));
        return;
      }
      await sessions.get(sessionId)!.handleRequest(req, res);

    } else if (req.method === "DELETE") {
      const sessionId = req.headers["mcp-session-id"] as string | undefined;
      if (sessionId && sessions.has(sessionId)) {
        await sessions.get(sessionId)!.close();
        sessions.delete(sessionId);
      }
      res.writeHead(204).end();

    } else {
      res.writeHead(405).end("Method not allowed");
    }
  });

  await new Promise<void>(resolve => httpServer.listen(listenPort, resolve));
  console.log(`opentimeline MCP server listening on http://localhost:${listenPort}/mcp`);
}
