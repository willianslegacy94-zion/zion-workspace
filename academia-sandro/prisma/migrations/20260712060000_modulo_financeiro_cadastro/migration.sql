-- AlterTable
ALTER TABLE "alunos" ADD COLUMN     "cidade" TEXT,
ADD COLUMN     "dataNascimento" TIMESTAMP(3),
ADD COLUMN     "dataVencimento" TIMESTAMP(3),
ADD COLUMN     "email" TEXT,
ADD COLUMN     "lesoes" TEXT,
ADD COLUMN     "telefone" TEXT;

-- CreateTable
CREATE TABLE "despesas" (
    "id" UUID NOT NULL,
    "categoria" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "valor" DECIMAL(10,2) NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "recorrente" BOOLEAN NOT NULL DEFAULT false,
    "frequenciaRecorrencia" TEXT,
    "grupoRecorrenciaId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "despesas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pre_cadastros" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "idade" INTEGER,
    "dataNascimento" TIMESTAMP(3),
    "telefone" TEXT NOT NULL,
    "email" TEXT,
    "cidade" TEXT,
    "lesoes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Pendente',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pre_cadastros_pkey" PRIMARY KEY ("id")
);
