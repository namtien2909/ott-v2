CREATE TABLE "GuestHistoryImport" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "localId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuestHistoryImport_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GuestHistoryImport_userId_localId_key" ON "GuestHistoryImport"("userId", "localId");
CREATE INDEX "GuestHistoryImport_userId_importedAt_idx" ON "GuestHistoryImport"("userId", "importedAt");
ALTER TABLE "GuestHistoryImport" ADD CONSTRAINT "GuestHistoryImport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
