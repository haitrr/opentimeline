# Place creation should not trigger visit detection

**Date:** 2026-04-12

## Problem

`POST /api/places` currently calls `detectVisitsForPlace(place.id)` immediately after creating a place. This scans the entire location history for the new place and creates "suggested" visits synchronously before returning.

This is undesirable: place creation should be a lightweight write. Detection is expensive, and users do not always want every historical visit surfaced the moment they add a place.

## Goal

Creating a place via `POST /api/places` performs no automatic detection of past visits for that place. The `supersedesVisitId` transplant flow is preserved, since it is an explicit user action tied to a specific existing visit, not a full-history scan.

## Non-goals

- Changing detection behavior on `PUT /api/places/[id]` (edits still reconcile suggestions).
- Changing the manual `POST /api/visits/detect` endpoint.
- Changing background polling.
- Exposing a new "detect for this place" endpoint (not needed — `POST /api/visits/detect` already covers all active places).

## Changes

### 1. `app/api/places/route.ts`

- Remove the `await detectVisitsForPlace(place.id)` call that runs after the place is created (currently line 175).
- Remove `newVisits` from the 201 response body.
- Preserve the `supersedesVisitId` branch untouched: when the caller provides it, the existing visit is still transplanted to the new place.

Response shape (both paths): `{ place }`. The supersede branch still performs the transplant server-side, but the response body does not need to surface it — no caller reads it.

### 2. `tests/unit/api-places-post-supersede.test.ts`

- Drop any assertion that `detectVisitsForPlace` is called on the plain creation path.
- Keep supersede-path assertions that verify the visit is transplanted.
- Adjust response-shape assertions to no longer expect `newVisits`.

### 3. New test

Add a unit test: when `POST /api/places` is called with no `supersedesVisitId`, `detectVisitsForPlace` is not invoked and the response contains `{ place }` only.

### 4. Frontend callers

- `components/PlaceCreationModal.tsx` and any other caller of `POST /api/places`: stop reading `newVisits` from the response. If the UI surfaced a "N visits detected" message, remove it.

## Testing

- TDD: write the "no detection on plain create" test first; watch it fail; then remove the call.
- Run existing supersede tests; update assertions that depended on `newVisits`.
- `pnpm exec eslint .`
- Full test suite.

## Rollout / compatibility

Internal API, no external consumers. Frontend is updated in the same change, so no compatibility window is needed.
