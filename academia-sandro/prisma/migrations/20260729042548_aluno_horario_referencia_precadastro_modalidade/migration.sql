-- AlterTable
ALTER TABLE "alunos" ADD COLUMN     "agendaAulaReferenciaId" UUID;

-- AlterTable
ALTER TABLE "pre_cadastros" ADD COLUMN     "modalidadeInteresse" TEXT;

-- AddForeignKey
ALTER TABLE "alunos" ADD CONSTRAINT "alunos_agendaAulaReferenciaId_fkey" FOREIGN KEY ("agendaAulaReferenciaId") REFERENCES "agenda_aulas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
