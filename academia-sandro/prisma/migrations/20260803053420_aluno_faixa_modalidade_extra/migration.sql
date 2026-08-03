-- CreateTable
CREATE TABLE "aluno_faixas_modalidade" (
    "id" UUID NOT NULL,
    "modalidade" TEXT NOT NULL,
    "graduacaoFaixa" TEXT NOT NULL,
    "alunoId" UUID NOT NULL,

    CONSTRAINT "aluno_faixas_modalidade_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "aluno_faixas_modalidade_alunoId_modalidade_key" ON "aluno_faixas_modalidade"("alunoId", "modalidade");

-- AddForeignKey
ALTER TABLE "aluno_faixas_modalidade" ADD CONSTRAINT "aluno_faixas_modalidade_alunoId_fkey" FOREIGN KEY ("alunoId") REFERENCES "alunos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
