-- CreateTable
CREATE TABLE "modalidade_precos" (
    "modalidade" TEXT NOT NULL,
    "valor" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "modalidade_precos_pkey" PRIMARY KEY ("modalidade")
);
