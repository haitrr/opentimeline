-- CreateTable
CREATE TABLE "Place" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lon" DOUBLE PRECISION NOT NULL,
    "radius" DOUBLE PRECISION NOT NULL DEFAULT 50,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Place_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Visit" (
    "id" SERIAL NOT NULL,
    "placeId" INTEGER NOT NULL,
    "arrivalAt" TIMESTAMP(3) NOT NULL,
    "departureAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'suggested',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Visit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Visit_placeId_idx" ON "Visit"("placeId");

-- CreateIndex
CREATE INDEX "Visit_status_idx" ON "Visit"("status");

-- AddForeignKey
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "Place"("id") ON DELETE CASCADE ON UPDATE CASCADE;
