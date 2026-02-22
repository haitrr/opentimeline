-- CreateTable
CREATE TABLE "LocationPoint" (
    "id" SERIAL NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lon" DOUBLE PRECISION NOT NULL,
    "tst" INTEGER NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL,
    "acc" DOUBLE PRECISION,
    "batt" INTEGER,
    "tid" TEXT,
    "alt" DOUBLE PRECISION,
    "vel" DOUBLE PRECISION,
    "cog" DOUBLE PRECISION,
    "trigger" TEXT,
    "username" TEXT,
    "deviceId" TEXT,

    CONSTRAINT "LocationPoint_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LocationPoint_recordedAt_idx" ON "LocationPoint"("recordedAt");

-- CreateIndex
CREATE INDEX "LocationPoint_username_deviceId_recordedAt_idx" ON "LocationPoint"("username", "deviceId", "recordedAt");
