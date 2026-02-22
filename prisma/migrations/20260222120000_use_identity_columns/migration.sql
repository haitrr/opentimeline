-- Convert SERIAL-backed id columns to SQL-standard IDENTITY columns.
-- Keeps ids as Int while avoiding SERIAL sequence drift behavior.

-- LocationPoint
ALTER TABLE "LocationPoint" ALTER COLUMN "id" DROP DEFAULT;
DROP SEQUENCE IF EXISTS "LocationPoint_id_seq";
ALTER TABLE "LocationPoint" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY;
SELECT setval(
  pg_get_serial_sequence('"LocationPoint"', 'id'),
  COALESCE((SELECT MAX(id) FROM "LocationPoint"), 0) + 1,
  false
);

-- Place
ALTER TABLE "Place" ALTER COLUMN "id" DROP DEFAULT;
DROP SEQUENCE IF EXISTS "Place_id_seq";
ALTER TABLE "Place" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY;
SELECT setval(
  pg_get_serial_sequence('"Place"', 'id'),
  COALESCE((SELECT MAX(id) FROM "Place"), 0) + 1,
  false
);

-- Visit
ALTER TABLE "Visit" ALTER COLUMN "id" DROP DEFAULT;
DROP SEQUENCE IF EXISTS "Visit_id_seq";
ALTER TABLE "Visit" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY;
SELECT setval(
  pg_get_serial_sequence('"Visit"', 'id'),
  COALESCE((SELECT MAX(id) FROM "Visit"), 0) + 1,
  false
);

-- UnknownVisitSuggestion
ALTER TABLE "UnknownVisitSuggestion" ALTER COLUMN "id" DROP DEFAULT;
DROP SEQUENCE IF EXISTS "UnknownVisitSuggestion_id_seq";
ALTER TABLE "UnknownVisitSuggestion" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY;
SELECT setval(
  pg_get_serial_sequence('"UnknownVisitSuggestion"', 'id'),
  COALESCE((SELECT MAX(id) FROM "UnknownVisitSuggestion"), 0) + 1,
  false
);
