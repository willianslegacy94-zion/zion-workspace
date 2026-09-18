"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

async function exigirGestor() {
  const session = await auth();
  if (!session?.user || session.user.papel !== "GESTOR") {
    // RF-002/RNF-002 — Financeiro é módulo exclusivo do gestor.
    throw new Error("Acesso restrito ao gestor.");
  }
  return session;
}

export type ResumoCaixa = {
  sessaoAberta: {
    id: string;
    abertaEm: string;
    valorAbertura: number;
    totalVendido: number;
    esperado: number;
  } | null;
  historico: Array<{
    id: string;
    abertaEm: string;
    valorAbertura: number;
    totalVendido: number;
    valorFechamento: number;
    diferenca: number;
  }>;
};

/** RF-013/RF-025 — visão do caixa atual e histórico com diferença de fechamento. */
export async function buscarResumoCaixa(): Promise<ResumoCaixa> {
  await exigirGestor();

  const [sessaoAberta, fechadas] = await Promise.all([
    prisma.sessaoCaixa.findFirst({ where: { status: "ABERTA" } }),
    prisma.sessaoCaixa.findMany({ where: { status: "FECHADA" }, orderBy: { fechadaEm: "desc" }, take: 6 }),
  ]);

  const idsFechadas = fechadas.map((s) => s.id);
  const vendasPorSessao =
    idsFechadas.length > 0
      ? await prisma.venda.groupBy({
          by: ["sessaoCaixaId"],
          where: { sessaoCaixaId: { in: idsFechadas }, status: "FINALIZADA" },
          _sum: { valorTotal: true },
        })
      : [];
  const totalPorSessao = new Map(
    vendasPorSessao.map((v) => [v.sessaoCaixaId, v._sum.valorTotal ? Number(v._sum.valorTotal) : 0]),
  );

  let sessaoAbertaResumo: ResumoCaixa["sessaoAberta"] = null;
  if (sessaoAberta) {
    const vendasAbertas = await prisma.venda.aggregate({
      where: { sessaoCaixaId: sessaoAberta.id, status: "FINALIZADA" },
      _sum: { valorTotal: true },
    });
    const totalVendido = vendasAbertas._sum.valorTotal ? Number(vendasAbertas._sum.valorTotal) : 0;
    const valorAbertura = Number(sessaoAberta.valorAbertura);
    sessaoAbertaResumo = {
      id: sessaoAberta.id,
      abertaEm: sessaoAberta.abertaEm.toISOString(),
      valorAbertura,
      totalVendido,
      esperado: valorAbertura + totalVendido,
    };
  }

  const historico = fechadas.map((s) => {
    const totalVendido = totalPorSessao.get(s.id) ?? 0;
    const valorAbertura = Number(s.valorAbertura);
    const valorFechamento = s.valorFechamento ? Number(s.valorFechamento) : 0;
    return {
      id: s.id,
      abertaEm: s.abertaEm.toISOString(),
      valorAbertura,
      totalVendido,
      valorFechamento,
      diferenca: valorFechamento - (valorAbertura + totalVendido),
    };
  });

  return { sessaoAberta: sessaoAbertaResumo, historico };
}

export type CategoriaFinanceiraOption = { id: string; nome: string; natureza: "FIXA" | "VARIAVEL" };

export async function listarCategoriasFinanceiras(): Promise<CategoriaFinanceiraOption[]> {
  await exigirGestor();
  return prisma.categoriaFinanceira.findMany({
    select: { id: true, nome: true, natureza: true },
    orderBy: { nome: "asc" },
  });
}

export type AcaoState = { ok: boolean; message?: string };

const categoriaSchema = z.object({
  nome: z.string().trim().min(1, "Informe o nome da categoria."),
  natureza: z.enum(["FIXA", "VARIAVEL"]),
});

export async function criarCategoriaFinanceira(
  _prevState: AcaoState,
  formData: FormData,
): Promise<AcaoState> {
  try {
    await exigirGestor();
    const parsed = categoriaSchema.safeParse({
      nome: formData.get("nome"),
      natureza: formData.get("natureza"),
    });
    if (!parsed.success) {
      return { ok: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos." };
    }
    await prisma.categoriaFinanceira.create({ data: parsed.data });
    revalidatePath("/financeiro");
    return { ok: true };
  } catch {
    return { ok: false, message: "Não foi possível criar a categoria." };
  }
}

// "Vencida" não é persistida — calculada na leitura comparando vencimento
// com hoje, evitando job/cron só pra transicionar um status (RF-024).
export type ContaFinanceiraResumo = {
  id: string;
  tipo: "PAGAR" | "RECEBER";
  categoriaNome: string;
  descricao: string;
  valor: number;
  vencimento: string;
  status: "PENDENTE" | "PAGA_RECEBIDA" | "VENCIDA";
  baixadaEm: string | null;
};

export async function listarContasFinanceiras(filtro?: {
  tipo?: "PAGAR" | "RECEBER";
}): Promise<ContaFinanceiraResumo[]> {
  await exigirGestor();

  const contas = await prisma.contaFinanceira.findMany({
    where: filtro?.tipo ? { tipo: filtro.tipo } : undefined,
    include: { categoria: { select: { nome: true } } },
    orderBy: { vencimento: "asc" },
  });

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  return contas.map((conta) => {
    const vencida = conta.status === "PENDENTE" && conta.vencimento < hoje;
    return {
      id: conta.id,
      tipo: conta.tipo,
      categoriaNome: conta.categoria.nome,
      descricao: conta.descricao,
      valor: Number(conta.valor),
      vencimento: conta.vencimento.toISOString().slice(0, 10),
      status: vencida ? "VENCIDA" : conta.status,
      baixadaEm: conta.baixadaEm ? conta.baixadaEm.toISOString() : null,
    };
  });
}

const contaSchema = z.object({
  tipo: z.enum(["PAGAR", "RECEBER"]),
  categoriaId: z.string().uuid("Selecione uma categoria."),
  descricao: z.string().trim().min(1, "Informe a descrição."),
  valor: z.coerce.number().positive("Valor precisa ser maior que zero."),
  vencimento: z.string().refine((v) => !Number.isNaN(Date.parse(v)), "Data de vencimento inválida."),
});

/** RF-023 — lança conta a pagar ou a receber. */
export async function criarContaFinanceira(_prevState: AcaoState, formData: FormData): Promise<AcaoState> {
  try {
    await exigirGestor();
    const parsed = contaSchema.safeParse({
      tipo: formData.get("tipo"),
      categoriaId: formData.get("categoriaId"),
      descricao: formData.get("descricao"),
      valor: formData.get("valor"),
      vencimento: formData.get("vencimento"),
    });
    if (!parsed.success) {
      return { ok: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos." };
    }

    await prisma.contaFinanceira.create({
      data: {
        tipo: parsed.data.tipo,
        categoriaId: parsed.data.categoriaId,
        descricao: parsed.data.descricao,
        valor: parsed.data.valor,
        vencimento: new Date(parsed.data.vencimento),
      },
    });

    revalidatePath("/financeiro");
    return { ok: true };
  } catch {
    return { ok: false, message: "Não foi possível lançar a conta." };
  }
}

/** RF-024 — dá baixa (paga/recebe) numa conta pendente ou vencida. */
export async function darBaixaConta(contaId: string): Promise<AcaoState> {
  try {
    await exigirGestor();

    const conta = await prisma.contaFinanceira.findUnique({ where: { id: contaId } });
    if (!conta || conta.status === "PAGA_RECEBIDA") {
      return { ok: false, message: "Essa conta já foi baixada." };
    }

    await prisma.contaFinanceira.update({
      where: { id: contaId },
      data: { status: "PAGA_RECEBIDA", baixadaEm: new Date() },
    });

    revalidatePath("/financeiro");
    return { ok: true };
  } catch {
    return { ok: false, message: "Não foi possível dar baixa na conta." };
  }
}
