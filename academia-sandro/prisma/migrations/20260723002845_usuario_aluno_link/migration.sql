
-- AlterTable
ALTER TABLE "usuarios" ADD COLUMN     "alunoId" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_alunoId_key" ON "usuarios"("alunoId");

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_alunoId_fkey" FOREIGN KEY ("alunoId") REFERENCES "alunos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

