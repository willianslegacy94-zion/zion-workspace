-- CreateEnum
CREATE TYPE "DiaSemana" AS ENUM ('SEGUNDA', 'TERCA', 'QUARTA', 'QUINTA', 'SEXTA', 'SABADO', 'DOMINGO');

-- CreateEnum
CREATE TYPE "StatusPresenca" AS ENUM ('AGENDADO', 'CONFIRMADO', 'CANCELADO', 'FALTA_SEM_AVISO');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'ALUNO');

-- AlterTable
ALTER TABLE "transacoes_financeiras" ADD COLUMN     "comprovanteUrl" TEXT,
ADD COLUMN     "gatewayPagamentoId" TEXT;

-- AlterTable
ALTER TABLE "usuarios" ADD COLUMN     "role" "Role" NOT NULL DEFAULT 'ALUNO';

-- CreateTable
CREATE TABLE "agenda_aulas" (
    "id" UUID NOT NULL,
    "diaSemana" "DiaSemana" NOT NULL,
    "horarioInicio" TIME NOT NULL,
    "horarioFim" TIME,
    "modalidade" TEXT NOT NULL,
    "capacidadeMax" INTEGER NOT NULL DEFAULT 10,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agenda_aulas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "presencas_diarias" (
    "id" UUID NOT NULL,
    "data" DATE NOT NULL,
    "status" "StatusPresenca" NOT NULL DEFAULT 'AGENDADO',
    "observacao" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "alunoId" UUID NOT NULL,
    "agendaAulaId" UUID NOT NULL,

    CONSTRAINT "presencas_diarias_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "presencas_diarias_alunoId_agendaAulaId_data_key" ON "presencas_diarias"("alunoId", "agendaAulaId", "data");

-- AddForeignKey
ALTER TABLE "presencas_diarias" ADD CONSTRAINT "presencas_diarias_alunoId_fkey" FOREIGN KEY ("alunoId") REFERENCES "alunos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presencas_diarias" ADD CONSTRAINT "presencas_diarias_agendaAulaId_fkey" FOREIGN KEY ("agendaAulaId") REFERENCES "agenda_aulas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

