CREATE TABLE "RankedMatchResult" (
    "matchId" TEXT NOT NULL,
    "blueUserId" TEXT NOT NULL,
    "redUserId" TEXT NOT NULL,
    "resultReason" TEXT NOT NULL,
    "blueBefore" INTEGER NOT NULL,
    "blueAfter" INTEGER NOT NULL,
    "blueDelta" INTEGER NOT NULL,
    "redBefore" INTEGER NOT NULL,
    "redAfter" INTEGER NOT NULL,
    "redDelta" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RankedMatchResult_pkey" PRIMARY KEY ("matchId")
);
