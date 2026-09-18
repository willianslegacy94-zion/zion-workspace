-- AlterTable
ALTER TABLE "itens_nota_fiscal" ADD COLUMN     "numeroLote" TEXT,
ADD COLUMN     "validade" DATE;

-- AlterTable
ALTER TABLE "itens_venda" ADD COLUMN     "loteId" UUID,
ADD COLUMN     "receitaConfirmada" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "produtos" ADD COLUMN     "medicamentoControlado" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "vendas" ADD COLUMN     "descontoValor" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "lotes_produto" (
    "id" UUID NOT NULL,
    "produtoId" UUID NOT NULL,
    "numeroLote" TEXT NOT NULL,
    "validade" DATE NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lotes_produto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lotes_produto_produtoId_validade_idx" ON "lotes_produto"("produtoId", "validade");

-- CreateIndex
CREATE UNIQUE INDEX "lotes_produto_produtoId_numeroLote_key" ON "lotes_produto"("produtoId", "numeroLote");

-- AddForeignKey
ALTER TABLE "lotes_produto" ADD CONSTRAINT "lotes_produto_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "produtos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itens_venda" ADD CONSTRAINT "itens_venda_loteId_fkey" FOREIGN KEY ("loteId") REFERENCES "lotes_produto"("id") ON DELETE SET NULL ON UPDATE CASCADE;
