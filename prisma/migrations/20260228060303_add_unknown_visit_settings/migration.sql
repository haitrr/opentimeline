-- AlterTable
ALTER TABLE "AppSettings" ADD COLUMN     "unknownClusterRadiusM" INTEGER NOT NULL DEFAULT 50,
ADD COLUMN     "unknownMinDwellMinutes" INTEGER NOT NULL DEFAULT 15,
ADD COLUMN     "unknownSessionGapMinutes" INTEGER NOT NULL DEFAULT 15;
