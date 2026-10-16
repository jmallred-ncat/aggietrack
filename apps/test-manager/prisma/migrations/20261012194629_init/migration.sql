-- CreateTable
CREATE TABLE "WorkbookRecord" (
    "section" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "values" JSONB NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY ("section", "id")
);

-- CreateTable
CREATE TABLE "RecordHistory" (
    "sequence" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "section" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "savedAt" TEXT NOT NULL,
    "values" JSONB NOT NULL
);

-- CreateTable
CREATE TABLE "ImportMetadata" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL
);

-- CreateIndex
CREATE INDEX "WorkbookRecord_section_position_idx" ON "WorkbookRecord"("section", "position");

-- CreateIndex
CREATE INDEX "RecordHistory_section_recordId_idx" ON "RecordHistory"("section", "recordId");
