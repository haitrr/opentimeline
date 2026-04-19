-- CreateTable
CREATE TABLE "DeviceFilter" (
    "id" TEXT NOT NULL,
    "fromTime" TIMESTAMP(3) NOT NULL,
    "toTime" TIMESTAMP(3) NOT NULL,
    "deviceIds" TEXT[],
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeviceFilter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DeviceFilter_fromTime_toTime_idx" ON "DeviceFilter"("fromTime", "toTime");
