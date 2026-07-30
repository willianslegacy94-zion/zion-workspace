"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { MODALIDADES } from "@/lib/modalidades";
import { DIAS_GRADE } from "@/lib/agenda-constants";
import {
  caiNoAlmoco,
  getConfiguracaoAgenda,
  horaParaData,
  salvarAlmoco,
} from "@/lib/configuracao-agenda";

export async function salvarPrecosModalidade(formData: FormData) {
  await Promise.all(
    MODALIDADES.map((modalidade) => {
      const valorRaw = String(formData.get(`preco_${modalidade}`) ?? "0")
        .trim()
        .replace(",", ".");
      const valor = Number(valorRaw) || 0;

      return prisma.modalidadePreco.upsert({
        where: { modalidade },
        update: { valor },
        create: { modalidade, valor },
      });
    }),
  );

  revalidatePath("/agenda");
  revalidatePath("/aluno/matricula");
}

export async function criarAula(formData: FormData) {
  const modalidade = String(formData.get("modalidade") ?? "").trim();
  const diaSemana = String(formData.get("diaSemana") ?? "").trim();
  const hora = String(formData.get("hora") ?? "").trim();
  const capacidadeMax = Number(formData.get("capacidadeMax") ?? "10") || 10;

  if (!modalidade || !diaSemana || !hora) {
    throw new Error("Preencha modalidade, dia e horário.");
  }
  if (!DIAS_GRADE.includes(diaSemana as (typeof DIAS_GRADE)[number])) {
    throw new Error("Dia da semana inválido.");
  }

  const config = await getConfiguracaoAgenda();
  const horarioInicio = horaParaData(hora);

  if (caiNoAlmoco(horarioInicio, config)) {
    throw new Error(
      `Esse horário cai no intervalo de almoço configurado (${config.almocoInicio}–${config.almocoFim}).`,
    );
  }

  await prisma.agendaAula.create({
    data: {
      modalidade,
      diaSemana: diaSemana as (typeof DIAS_GRADE)[number],
      horarioInicio,
      capacidadeMax,
    },
  });

  revalidatePath("/agenda");
}

export async function atualizarCapacidadeAula(id: string, formData: FormData) {
  const capacidadeMax = Number(formData.get("capacidadeMax") ?? "0");

  if (!capacidadeMax || capacidadeMax < 1) {
    throw new Error("Capacidade deve ser pelo menos 1.");
  }

  await prisma.agendaAula.update({ where: { id }, data: { capacidadeMax } });
  revalidatePath("/agenda");
}

export async function excluirAula(id: string) {
  try {
    await prisma.agendaAula.delete({ where: { id } });
  } catch (error) {
    if ((error as { code?: string }).code === "P2003") {
      throw new Error(
        "Não é possível excluir — existem matrículas ou presenças vinculadas a este horário.",
      );
    }
    throw error;
  }

  revalidatePath("/agenda");
}

export async function salvarConfiguracaoAgenda(formData: FormData) {
  const horaInicio = String(formData.get("almocoInicio") ?? "").trim();
  const horaFim = String(formData.get("almocoFim") ?? "").trim();

  if (!horaInicio || !horaFim) {
    throw new Error("Preencha início e fim do horário de almoço.");
  }
  if (horaFim <= horaInicio) {
    throw new Error("O fim do almoço deve ser depois do início.");
  }

  await salvarAlmoco(horaInicio, horaFim);
  revalidatePath("/agenda");
}

export async function criarBloqueio(formData: FormData) {
  const data = String(formData.get("data") ?? "").trim();
  const horaInicio = String(formData.get("horaInicio") ?? "").trim();
  const horaFim = String(formData.get("horaFim") ?? "").trim();
  const motivo = String(formData.get("motivo") ?? "").trim() || null;

  if (!data || !horaInicio || !horaFim) {
    throw new Error("Preencha data, hora de início e hora de fim.");
  }
  if (horaFim <= horaInicio) {
    throw new Error("A hora de fim deve ser depois da hora de início.");
  }

  await prisma.bloqueioAgenda.create({
    data: {
      data: new Date(`${data}T00:00:00.000Z`),
      horaInicio: horaParaData(horaInicio),
      horaFim: horaParaData(horaFim),
      motivo,
    },
  });

  revalidatePath("/agenda");
  revalidatePath("/aluno");
}

export async function excluirBloqueio(id: string) {
  await prisma.bloqueioAgenda.delete({ where: { id } });
  revalidatePath("/agenda");
  revalidatePath("/aluno");
}
