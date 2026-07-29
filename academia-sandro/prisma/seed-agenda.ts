import "dotenv/config";
import { prisma } from "../src/lib/prisma";

// Grade real de horários da Academia Prof. Sandro (quadro físico afixado no espaço).

type DiaSemana =
  | "SEGUNDA"
  | "TERCA"
  | "QUARTA"
  | "QUINTA"
  | "SEXTA"
  | "SABADO";

type AulaSeed = {
  modalidade: string;
  dias: DiaSemana[];
  horarios: string[];
  capacidadeMax?: number;
};

const HORARIOS_MUSCULACAO = [
  "07:00",
  "08:00",
  "10:00",
  "11:00",
  "14:00",
  "16:00",
  "17:00",
  "18:00",
  "21:00",
];

const HORARIOS_BOXE_MUAY_THAI = [
  "08:00",
  "10:00",
  "11:00",
  "14:00",
  "16:00",
  "17:00",
  "18:00",
  "20:00",
  "21:00",
];

const AULAS: AulaSeed[] = [
  {
    modalidade: "Musculação/Personal",
    dias: ["SEGUNDA", "TERCA", "QUARTA", "QUINTA", "SEXTA", "SABADO"],
    horarios: HORARIOS_MUSCULACAO,
  },
  {
    modalidade: "Capoeira",
    dias: ["SEGUNDA", "QUARTA"],
    horarios: ["19:00", "20:00"],
  },
  {
    modalidade: "Boxe/Muay Thai",
    dias: ["TERCA", "QUINTA"],
    horarios: HORARIOS_BOXE_MUAY_THAI,
  },
  {
    modalidade: "Aula para Idosos",
    dias: ["TERCA", "QUINTA"],
    horarios: ["09:00"],
  },
  {
    modalidade: "Kids",
    dias: ["TERCA", "QUINTA"],
    horarios: ["19:00"],
  },
];

function horaParaData(hora: string): Date {
  return new Date(`1970-01-01T${hora}:00.000Z`);
}

async function main() {
  let criadas = 0;
  let ignoradas = 0;

  for (const aula of AULAS) {
    for (const diaSemana of aula.dias) {
      for (const horario of aula.horarios) {
        const horarioInicio = horaParaData(horario);

        const existente = await prisma.agendaAula.findFirst({
          where: { modalidade: aula.modalidade, diaSemana, horarioInicio },
        });
        if (existente) {
          ignoradas++;
          continue;
        }

        await prisma.agendaAula.create({
          data: {
            modalidade: aula.modalidade,
            diaSemana,
            horarioInicio,
            capacidadeMax: aula.capacidadeMax ?? 10,
          },
        });
        criadas++;
      }
    }
  }

  console.log(
    `Seed de agenda concluído: ${criadas} horário(s) criado(s), ${ignoradas} já existiam.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
