-- CreateTable
CREATE TABLE "UnknownVisitSuggestion" (
    "id" SERIAL NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lon" DOUBLE PRECISION NOT NULL,
    "arrivalAt" TIMESTAMP(3) NOT NULL,
    "departureAt" TIMESTAMP(3) NOT NULL,
    "pointCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'suggested',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UnknownVisitSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UnknownVisitSuggestion_status_idx" ON "UnknownVisitSuggestion"("status");
