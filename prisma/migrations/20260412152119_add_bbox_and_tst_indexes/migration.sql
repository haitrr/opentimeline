-- CreateIndex
CREATE INDEX "LocationPoint_recordedAt_lat_lon_idx" ON "LocationPoint"("recordedAt", "lat", "lon");

-- CreateIndex
CREATE INDEX "LocationPoint_tst_id_idx" ON "LocationPoint"("tst", "id");

-- CreateIndex
CREATE INDEX "Place_lat_lon_idx" ON "Place"("lat", "lon");
