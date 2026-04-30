# Detect Visits Button for Place Detail

## Summary

Add a "Detect visits" button to the `PlaceDetailHeader` component that triggers visit detection for the specific place across all time.

## API

**New route:** `POST /api/places/[id]/detect-visits`

- Validates `id` is a valid integer; returns 400 if not
- Returns 404 if place does not exist
- Calls `detectVisitsForPlace(placeId)` from `lib/detectVisits.ts`
- Returns `{ newVisits: number }`

## UI

**Component:** `PlaceDetailHeader`

- "Detect visits" button added in the non-editing view, next to the Deactivate/Activate button
- Matches existing button style: `rounded border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100`
- While in-flight: label changes to "Detecting…", button is disabled
- On success: invalidates `["places"]` and `["visits"]` query keys via `queryClient` (already available in header)
- On error: no special UI — silent failure is acceptable given the low stakes of this action

## Testing

- Unit test for the new API route: valid place returns `{ newVisits: number }`, invalid id returns 400, missing place returns 404
- No new component tests needed — the button follows the same pattern as the existing toggle-active button
