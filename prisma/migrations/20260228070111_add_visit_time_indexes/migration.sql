-- CreateIndex
CREATE INDEX "UnknownVisitSuggestion_arrivalAt_idx" ON "UnknownVisitSuggestion"("arrivalAt");

-- CreateIndex
CREATE INDEX "UnknownVisitSuggestion_departureAt_idx" ON "UnknownVisitSuggestion"("departureAt");

-- CreateIndex
CREATE INDEX "Visit_placeId_status_idx" ON "Visit"("placeId", "status");

-- CreateIndex
CREATE INDEX "Visit_arrivalAt_idx" ON "Visit"("arrivalAt");

-- CreateIndex
CREATE INDEX "Visit_departureAt_idx" ON "Visit"("departureAt");
