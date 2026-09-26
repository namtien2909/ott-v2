ALTER TABLE "FriendRequest" ADD COLUMN "pairKey" TEXT;
UPDATE "FriendRequest" SET "pairKey" = LEAST("senderId", "recipientId") || ':' || GREATEST("senderId", "recipientId");
ALTER TABLE "FriendRequest" ALTER COLUMN "pairKey" SET NOT NULL;
CREATE UNIQUE INDEX "FriendRequest_pairKey_key" ON "FriendRequest"("pairKey");
