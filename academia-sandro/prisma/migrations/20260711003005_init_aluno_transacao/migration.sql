-- CreateTable
CREATE TABLE "alunos" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "modalidade" TEXT NOT NULL,
    "graduacaoFaixa" TEXT NOT NULL,
    "dataMatricula" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "statusPagamento" TEXT NOT NULL,
    "aptoExame" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "alunos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transacoes_financeiras" (
    "id" UUID NOT NULL,
    "tipo" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "valor" DECIMAL(10,2) NOT NULL,
    "dataTransacao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "alunoId" UUID,

    CONSTRAINT "transacoes_financeiras_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "transacoes_financeiras" ADD CONSTRAINT "transacoes_financeiras_alunoId_fkey" FOREIGN KEY ("alunoId") REFERENCES "alunos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
