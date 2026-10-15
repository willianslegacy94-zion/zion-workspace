-- CreateTable
CREATE TABLE "Desk" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "setup" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Desk_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Desk_spaceId_key_key" ON "Desk"("spaceId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "Desk_spaceId_userId_key" ON "Desk"("spaceId", "userId");

-- AddForeignKey
ALTER TABLE "Desk" ADD CONSTRAINT "Desk_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "Space"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Desk" ADD CONSTRAINT "Desk_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
