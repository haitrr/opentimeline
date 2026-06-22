import http from "node:http";
import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import {
  confirmUnknownVisit,
  createPlaceFromUnknownVisit,
  getCurrentLocation,
  getLocationHistory,
  getPendingUnknownVisits,
  getPlaces,
  getVisits,
  reviewUnknownVisit,
  triggerUnknownVisitDetection,
  triggerVisitDetection,
} from "@/mcp/actions";

function jsonContent(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value) }] };
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
      return jsonContent(await triggerVisitDetection({ start, end }));
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
      return jsonContent(await triggerUnknownVisitDetection({ start, end }));
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
      return jsonContent(await getPendingUnknownVisits({ status, start, end, limit }));
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
      return jsonContent(await reviewUnknownVisit(id));
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
      return jsonContent(await confirmUnknownVisit(id, status));
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
      return jsonContent(await createPlaceFromUnknownVisit({ id, name, radius }));
    }
  );

  server.registerTool(
    "get_current_location",
    { description: "Get the most recent location point recorded for the user." },
    async () => {
      return jsonContent(await getCurrentLocation());
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
      return jsonContent(await getLocationHistory({ date, start, end, limit }));
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
      return jsonContent(await getVisits({ start, end, status, date, limit }));
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
      return jsonContent(await getPlaces({ activeOnly: active_only }));
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
