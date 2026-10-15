-- CreateTable
CREATE TABLE "Visit" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3) NOT NULL,
    "messages" INTEGER NOT NULL DEFAULT 0,
    "talkSeconds" INTEGER NOT NULL DEFAULT 0,
    "zones" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "Visit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Visit_spaceId_startedAt_idx" ON "Visit"("spaceId", "startedAt");

-- AddForeignKey
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "Space"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
