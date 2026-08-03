-- CreateEnum
CREATE TYPE "TipoPacote" AS ENUM ('FAMILIA', 'COMBO_MODALIDADES');

-- AlterTable
ALTER TABLE "alunos" ADD COLUMN     "mensalidadeValor" DECIMAL(10,2);

-- CreateTable
CREATE TABLE "pacotes" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" "TipoPacote" NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pacotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pacote_membros" (
    "id" UUID NOT NULL,
    "descontoPercentual" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "titular" BOOLEAN NOT NULL DEFAULT false,
    "pacoteId" UUID NOT NULL,
    "alunoId" UUID NOT NULL,

    CONSTRAINT "pacote_membros_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pacote_membros_alunoId_key" ON "pacote_membros"("alunoId");

-- AddForeignKey
ALTER TABLE "pacote_membros" ADD CONSTRAINT "pacote_membros_pacoteId_fkey" FOREIGN KEY ("pacoteId") REFERENCES "pacotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pacote_membros" ADD CONSTRAINT "pacote_membros_alunoId_fkey" FOREIGN KEY ("alunoId") REFERENCES "alunos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
