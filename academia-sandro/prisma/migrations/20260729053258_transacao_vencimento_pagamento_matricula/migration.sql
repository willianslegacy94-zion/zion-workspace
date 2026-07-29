-- AlterTable
ALTER TABLE "transacoes_financeiras" ADD COLUMN     "dataVencimento" TIMESTAMP(3),
ADD COLUMN     "formaPagamento" TEXT,
ADD COLUMN     "matriculaId" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "transacoes_financeiras_matriculaId_key" ON "transacoes_financeiras"("matriculaId");

-- AddForeignKey
ALTER TABLE "transacoes_financeiras" ADD CONSTRAINT "transacoes_financeiras_matriculaId_fkey" FOREIGN KEY ("matriculaId") REFERENCES "matriculas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

