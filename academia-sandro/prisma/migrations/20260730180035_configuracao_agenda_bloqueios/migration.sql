-- CreateTable
CREATE TABLE "configuracao_agenda" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "almocoInicio" TIME,
    "almocoFim" TIME,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "configuracao_agenda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bloqueios_agenda" (
    "id" UUID NOT NULL,
    "data" DATE NOT NULL,
    "horaInicio" TIME NOT NULL,
    "horaFim" TIME NOT NULL,
    "motivo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bloqueios_agenda_pkey" PRIMARY KEY ("id")
);
