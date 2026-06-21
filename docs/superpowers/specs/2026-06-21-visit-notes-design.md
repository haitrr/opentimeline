# Visit Notes — Design Spec

**Date:** 2026-06-21

## Summary

Add a markdown-supported notes field to visits. Notes are edited in the EditVisitModal and rendered on the VisitCard when present.

---

## Data Layer

- Add `notes String?` (nullable) to the `Visit` model in `prisma/schema.prisma`.
- Generate and apply a Prisma migration.
- Update the `Visit` TypeScript type in `components/VisitCard.tsx` to include `notes?: string`.
- `PUT /api/visits/[id]`: accept and persist the optional `notes` field alongside existing fields.
- `POST /api/visits`: accept optional `notes` on creation.

## EditVisitModal

- Add a `<textarea>` labelled "Notes (markdown supported)" at the bottom of the form in `components/EditVisitModal.tsx`.
- Include `notes` in form state, initialized from the visit's existing notes value.
- Submit `notes` alongside other fields on save.
- Font size ≥ 16px to prevent iOS zoom.
- No live preview — rendered output appears on VisitCard after saving.

## VisitCard

- Install `react-markdown` as a dependency.
- When `visit.notes` is non-empty, render it below sub-places badges and photos using `react-markdown`.
- Wrap in a visually subtle container (light border or muted background) to distinguish from structural visit info.
- Notes are always visible when present — no toggle.

---

## Testing

- Unit tests (vitest): notes field included in API PUT/POST request and response; VisitCard renders markdown notes when present; VisitCard renders nothing for notes when absent.
- E2E tests (playwright): add a note in EditVisitModal, save, verify rendered markdown appears on VisitCard.
