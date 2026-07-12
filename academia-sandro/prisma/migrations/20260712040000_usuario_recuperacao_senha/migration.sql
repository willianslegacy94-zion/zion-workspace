-- AlterTable
ALTER TABLE "usuarios" ADD COLUMN     "senhaTemporaria" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "tokenExpiracao" TIMESTAMP(3),
ADD COLUMN     "tokenRecuperacao" TEXT,
ADD COLUMN     "username" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_username_key" ON "usuarios"("username");
