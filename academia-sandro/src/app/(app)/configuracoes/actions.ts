"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { DIAS_GRADE, DIA_SEMANA_LABEL, formatarHora } from "@/lib/agenda-constants";
import type { DiaSemana } from "@/generated/prisma/client";
import {
  caiNoAlmoco,
  getConfiguracaoAgenda,
  horaParaData,
  salvarAlmoco,
} from "@/lib/configuracao-agenda";
import { enviarWhatsapp } from "@/lib/whatsapp-gateway";

// getUTCDay(): 0=domingo...6=sábado — BloqueioAgenda.data é sempre meia-noite
// UTC (ver criarBloqueio), então getUTCDay() bate certinho com o dia real
// escolhido no form, sem depender do timezone do servidor.
const DIA_SEMANA_POR_INDICE: DiaSemana[] = [
  "DOMINGO",
  "SEGUNDA",
  "TERCA",
  "QUARTA",
  "QUINTA",
  "SEXTA",
  "SABADO",
];

// Avisa no WhatsApp todo aluno que tem acesso a algum horário dentro da
// janela bloqueada nesse dia — principal da modalidade (acesso implícito a
// todos os horários dela) + quem tem Matricula extra nesse horário
// específico. Falha de envio por aluno só loga, nunca derruba o bloqueio
// nem os próximos envios (ver enviarWhatsapp em whatsapp-gateway.ts).
async function notificarAlunosDoBloqueio(params: {
  data: Date;
  horaInicio: string;
  horaFim: string;
  motivo: string | null;
}) {
  const diaSemana = DIA_SEMANA_POR_INDICE[params.data.getUTCDay()];

  const aulasNoIntervalo = await prisma.agendaAula.findMany({
    where: { diaSemana },
    include: { matriculas: { include: { aluno: true } } },
  });

  const afetadas = aulasNoIntervalo.filter((aula) => {
    const hora = formatarHora(aula.horarioInicio);
    return hora >= params.horaInicio && hora < params.horaFim;
  });
  if (afetadas.length === 0) return;

  const modalidadesAfetadas = new Set(afetadas.map((a) => a.modalidade));

  const alunosPrincipais = await prisma.aluno.findMany({
    where: { modalidade: { in: Array.from(modalidadesAfetadas) }, telefone: { not: null } },
    select: { id: true, nome: true, telefone: true },
  });

  const alunosPorId = new Map<string, { nome: string; telefone: string }>();
  for (const aluno of alunosPrincipais) {
    if (aluno.telefone) alunosPorId.set(aluno.id, { nome: aluno.nome, telefone: aluno.telefone });
  }
  for (const aula of afetadas) {
    for (const matricula of aula.matriculas) {
      if (matricula.aluno.telefone) {
        alunosPorId.set(matricula.aluno.id, {
          nome: matricula.aluno.nome,
          telefone: matricula.aluno.telefone,
        });
      }
    }
  }

  const dataFormatada = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(params.data);
  const mensagemBase =
    `⚠️ Aviso do Centro de Treinamento Sandro Freire: não vai ter aula em ` +
    `${DIA_SEMANA_LABEL[diaSemana]} (${dataFormatada}), das ${params.horaInicio} às ${params.horaFim}` +
    (params.motivo ? ` — ${params.motivo}` : "") +
    ".";

  await Promise.all(
    Array.from(alunosPorId.values()).map(async (aluno) => {
      const resultado = await enviarWhatsapp(aluno.telefone, mensagemBase);
      if (!resultado.enviado) {
        console.error(`Falha ao avisar ${aluno.nome} do bloqueio de agenda:`, resultado.erro);
      }
    }),
  );
}

export async function atualizarPerfil(formData: FormData) {
  "use server";

  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    redirect("/login");
  }

  const nome = String(formData.get("nome") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const telefone = String(formData.get("telefone") ?? "").trim() || null;
  const pix = String(formData.get("pix") ?? "").trim() || null;

  if (!nome || !email) {
    redirect("/configuracoes?erro=" + encodeURIComponent("Preencha nome e e-mail."));
  }

  try {
    await prisma.usuario.update({
      where: { id: userId },
      data: { nome, email, telefone, pix },
    });
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") {
      redirect(
        "/configuracoes?erro=" +
          encodeURIComponent("Este e-mail já está em uso por outro usuário."),
      );
    }
    throw error;
  }

  revalidatePath("/configuracoes");
  revalidatePath("/aluno/financeiro");
  redirect("/configuracoes?sucesso=1");
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

  revalidatePath("/configuracoes");
  revalidatePath("/agenda");
  revalidatePath("/aluno");
  revalidatePath("/aluno/matricula");
}

export async function atualizarCapacidadeAula(id: string, formData: FormData) {
  const capacidadeMax = Number(formData.get("capacidadeMax") ?? "0");

  if (!capacidadeMax || capacidadeMax < 1) {
    throw new Error("Capacidade deve ser pelo menos 1.");
  }

  await prisma.agendaAula.update({ where: { id }, data: { capacidadeMax } });
  revalidatePath("/configuracoes");
  revalidatePath("/agenda");
  revalidatePath("/aluno");
  revalidatePath("/aluno/matricula");
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

  revalidatePath("/configuracoes");
  revalidatePath("/agenda");
  revalidatePath("/aluno");
  revalidatePath("/aluno/matricula");
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
  revalidatePath("/configuracoes");
  revalidatePath("/agenda");
  revalidatePath("/aluno");
  revalidatePath("/aluno/matricula");
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

  const dataBloqueio = new Date(`${data}T00:00:00.000Z`);

  await prisma.bloqueioAgenda.create({
    data: {
      data: dataBloqueio,
      horaInicio: horaParaData(horaInicio),
      horaFim: horaParaData(horaFim),
      motivo,
    },
  });

  await notificarAlunosDoBloqueio({ data: dataBloqueio, horaInicio, horaFim, motivo });

  revalidatePath("/configuracoes");
  revalidatePath("/agenda");
  revalidatePath("/aluno");
}

export async function excluirBloqueio(id: string) {
  await prisma.bloqueioAgenda.delete({ where: { id } });
  revalidatePath("/configuracoes");
  revalidatePath("/agenda");
  revalidatePath("/aluno");
}
