-- CreateTable
CREATE TABLE "AppSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "sessionGapMinutes" INTEGER NOT NULL DEFAULT 15,
    "minDwellMinutes" INTEGER NOT NULL DEFAULT 15,
    "postDepartureMinutes" INTEGER NOT NULL DEFAULT 15,

    CONSTRAINT "AppSettings_pkey" PRIMARY KEY ("id")
);
