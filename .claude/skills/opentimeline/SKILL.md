---
name: opentimeline
description: "Use when: querying or curating OpenTimeline location history, visits, places, unknown visit suggestions, MCP tools, or the opentimeline CLI from Claude Code or another AI agent."
argument-hint: "timeline question or curation task"
---

# OpenTimeline Agent Skill

Use this skill when an agent needs to inspect or curate the user's OpenTimeline data from this repository.

## Access Paths

- Prefer MCP tools when they are available in the agent runtime. They expose the same actions as the CLI and avoid shell parsing.
- Prefer the CLI for Claude Code, terminal-only automation, or one-shot JSON queries.
- Use the web UI only for visual review, map inspection, or workflows that need human confirmation.

## CLI Commands

Use the installed `opentimeline` CLI command. It should be configured to run from the OpenTimeline repository so `.env`, `tsconfig.json`, and path aliases resolve correctly.

```bash
opentimeline --help
opentimeline current-location
opentimeline locations --date 2026-06-22 --limit 200
opentimeline locations --start 2026-06-22T00:00:00Z --end 2026-06-23T00:00:00Z
opentimeline visits --date 2026-06-22 --status all
opentimeline places
opentimeline places --all
opentimeline detect-visits --start 2026-06-22T00:00:00Z --end 2026-06-23T00:00:00Z
opentimeline detect-unknown-visits --start 2026-06-22T00:00:00Z --end 2026-06-23T00:00:00Z
opentimeline unknown-visits --status suggested --limit 20
opentimeline review-unknown-visit 42
opentimeline confirm-unknown-visit 42 --status confirmed
opentimeline confirm-unknown-visit 42 --status rejected
opentimeline create-place-from-unknown-visit 42 --name "Coffee Shop" --radius 40
```

The CLI prints JSON by default. Add `--compact` when passing output to another command or when token budget matters.

## MCP Tools

When MCP is configured, use these tools for the equivalent workflows:

- `get_current_location`
- `get_location_history`
- `get_visits`
- `get_places`
- `trigger_visit_detection`
- `trigger_unknown_visit_detection`
- `get_pending_unknown_visits`
- `review_unknown_visit`
- `confirm_unknown_visit`
- `create_place_from_unknown_visit`

## Curation Workflow

1. Start with a bounded date or time range whenever possible.
2. Run visit detection before reviewing known-place visits if the data may be stale.
3. Run unknown-visit detection before asking the user to name missing places.
4. Review an unknown visit before creating a place from it; check duration, point count, nearby known places, and Immich photos when available.
5. Ask the user for a place name before creating a new place unless they already provided one.
6. Use conservative radii. Default to `50` meters, reduce to `20-40` meters in dense areas, and increase only when GPS noise justifies it.
7. After creating a place from an unknown visit, report the new place, number of new visits, and dismissed overlapping suggestions.

## Safety Notes

- Location history is private. Summarize only the fields needed for the user's task.
- Do not invent place names from coordinates. Use user-provided names or ask.
- Prefer read-only commands until the user asks to confirm, reject, detect, or create.
- `DATABASE_URL` must be configured in `.env`; Immich fields are optional.
