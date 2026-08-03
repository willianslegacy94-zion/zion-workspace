-- DropIndex
DROP INDEX "transacoes_financeiras_matriculaId_key";

-- AlterTable
ALTER TABLE "matriculas" ADD COLUMN     "dataVencimentoBase" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "pacotes" ADD COLUMN     "descontoPadrao" DECIMAL(5,2);

-- AlterTable
ALTER TABLE "pre_cadastros" ADD COLUMN     "dataAulaExperimental" DATE,
ADD COLUMN     "termosAceitos" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "termosAceitosEm" TIMESTAMP(3);
