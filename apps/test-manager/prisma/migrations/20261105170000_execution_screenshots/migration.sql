-- CreateTable
CREATE TABLE "ExecutionScreenshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "testId" TEXT NOT NULL,
    "historySequence" INTEGER,
    "pathname" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploadedById" TEXT NOT NULL,
    "uploadedByEmail" TEXT NOT NULL
);

-- CreateIndex
CREATE INDEX "ExecutionScreenshot_testId_historySequence_idx" ON "ExecutionScreenshot"("testId", "historySequence");
