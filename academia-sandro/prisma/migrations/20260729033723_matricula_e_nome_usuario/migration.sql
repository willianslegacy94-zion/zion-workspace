-- AlterTable
ALTER TABLE "usuarios" ADD COLUMN     "nome" TEXT;

-- CreateTable
CREATE TABLE "matriculas" (
    "id" UUID NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "alunoId" UUID NOT NULL,
    "agendaAulaId" UUID NOT NULL,

    CONSTRAINT "matriculas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "matriculas_alunoId_agendaAulaId_key" ON "matriculas"("alunoId", "agendaAulaId");

-- AddForeignKey
ALTER TABLE "matriculas" ADD CONSTRAINT "matriculas_alunoId_fkey" FOREIGN KEY ("alunoId") REFERENCES "alunos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matriculas" ADD CONSTRAINT "matriculas_agendaAulaId_fkey" FOREIGN KEY ("agendaAulaId") REFERENCES "agenda_aulas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
