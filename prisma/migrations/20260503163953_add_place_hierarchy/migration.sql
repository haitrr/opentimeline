-- AlterTable
ALTER TABLE "Place" ADD COLUMN     "parentId" INTEGER;

-- AlterTable
ALTER TABLE "Visit" ADD COLUMN     "parentVisitId" INTEGER;

-- CreateIndex
CREATE INDEX "Place_parentId_idx" ON "Place"("parentId");

-- CreateIndex
CREATE INDEX "Visit_parentVisitId_idx" ON "Visit"("parentVisitId");

-- AddForeignKey
ALTER TABLE "Place" ADD CONSTRAINT "Place_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Place"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_parentVisitId_fkey" FOREIGN KEY ("parentVisitId") REFERENCES "Visit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
