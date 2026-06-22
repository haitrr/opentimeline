#!/usr/bin/env node
import "dotenv/config";
import { prisma } from "@/lib/prisma";
import {
  confirmUnknownVisit,
  createPlaceFromUnknownVisit,
  getCurrentLocation,
  getLocationHistory,
  getPendingUnknownVisits,
  getPlaces,
  getVisits,
  triggerUnknownVisitDetection,
  triggerVisitDetection,
  reviewUnknownVisit,
  type UnknownVisitStatus,
  type VisitStatus,
} from "@/mcp/actions";

type ParsedArgs = {
  command?: string;
  positionals: string[];
  options: Record<string, string | boolean>;
};

const BOOLEAN_OPTIONS = new Set(["all", "compact", "help"]);

const HELP = `OpenTimeline CLI

Usage:
  opentimeline <command> [options]
  pnpm --silent opentimeline <command> [options]   # project-local fallback

Commands:
  current-location                         Print the latest recorded location point
  locations [--date YYYY-MM-DD]            Print GPS points for a date or time range
  visits [--date YYYY-MM-DD]               Print visits with place details
  places [--all]                           List places and visit counts
  detect-visits                            Run known-place visit detection
  detect-unknown-visits                    Run unknown-visit detection
  unknown-visits                           List unknown visit suggestions
  review-unknown-visit <id>                Show detail for an unknown visit suggestion
  confirm-unknown-visit <id>               Mark an unknown visit confirmed or rejected
  create-place-from-unknown-visit <id>     Create a place from an unknown visit

Common options:
  --start ISO                              Start datetime
  --end ISO                                End datetime
  --limit N                                Maximum rows to return
  --status VALUE                           Status filter where supported
  --compact                                Print compact JSON
  --help                                   Show this help

Examples:
  opentimeline visits --date 2026-06-22 --status all
  opentimeline locations --start 2026-06-22T00:00:00Z --end 2026-06-23T00:00:00Z --limit 200
  opentimeline unknown-visits --status suggested
  opentimeline create-place-from-unknown-visit 42 --name "Coffee Shop" --radius 40
`;

function parseArgs(argv: string[]): ParsedArgs {
  let command: string | undefined;
  const positionals: string[] = [];
  const options: Record<string, string | boolean> = {};

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (!arg.startsWith("--")) {
      if (command) positionals.push(arg);
      else command = arg;
      continue;
    }

    const key = arg.slice(2);
    if (BOOLEAN_OPTIONS.has(key)) {
      options[key] = true;
      continue;
    }

    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      options[key] = true;
      continue;
    }

    options[key] = next;
    index++;
  }

  return { command, positionals, options };
}

function getString(options: ParsedArgs["options"], key: string) {
  const value = options[key];
  return typeof value === "string" ? value : undefined;
}

function getNumber(options: ParsedArgs["options"], key: string) {
  const value = getString(options, key);
  if (value === undefined) return undefined;

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`--${key} must be a number`);
  return parsed;
}

function getId(parsed: ParsedArgs) {
  const raw = parsed.positionals[0];
  const id = Number(raw);
  if (!raw || !Number.isInteger(id) || id <= 0) throw new Error("A positive numeric id is required");
  return id;
}

function getStatus<T extends string>(options: ParsedArgs["options"], key: string, allowed: readonly T[], fallback: T) {
  const value = getString(options, key) ?? fallback;
  if (!allowed.includes(value as T)) throw new Error(`--${key} must be one of: ${allowed.join(", ")}`);
  return value as T;
}

async function runCommand(parsed: ParsedArgs) {
  const { command, options } = parsed;
  const start = getString(options, "start");
  const end = getString(options, "end");
  const date = getString(options, "date");
  const limit = getNumber(options, "limit");

  switch (command) {
    case undefined:
    case "help":
      return HELP;
    case "current-location":
      return getCurrentLocation();
    case "locations":
      return getLocationHistory({ date, start, end, limit });
    case "visits":
      return getVisits({ date, start, end, limit, status: getStatus<VisitStatus>(options, "status", ["confirmed", "suggested", "all"], "all") });
    case "places":
      return getPlaces({ activeOnly: options.all ? false : true });
    case "detect-visits":
      return triggerVisitDetection({ start, end });
    case "detect-unknown-visits":
      return triggerUnknownVisitDetection({ start, end });
    case "unknown-visits":
      return getPendingUnknownVisits({ start, end, limit, status: getStatus<UnknownVisitStatus>(options, "status", ["suggested", "confirmed", "rejected"], "suggested") });
    case "review-unknown-visit":
      return reviewUnknownVisit(getId(parsed));
    case "confirm-unknown-visit":
      return confirmUnknownVisit(getId(parsed), getStatus(options, "status", ["confirmed", "rejected"], "confirmed"));
    case "create-place-from-unknown-visit": {
      const name = getString(options, "name");
      if (!name) throw new Error("--name is required");
      return createPlaceFromUnknownVisit({ id: getId(parsed), name, radius: getNumber(options, "radius") });
    }
    default:
      throw new Error(`Unknown command: ${command}`);
  }
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2));
  if (parsed.options.help) {
    console.log(HELP);
    return;
  }

  const result = await runCommand(parsed);
  if (typeof result === "string") {
    console.log(result);
    return;
  }

  console.log(JSON.stringify(result, null, parsed.options.compact ? 0 : 2));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
