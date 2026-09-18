"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { parseNfeXml } from "@/lib/nfe/parser-xml";
import { parseComIA } from "@/lib/nfe/parser-ia";
import { sugerirVinculoProduto } from "@/lib/nfe/vinculo";
import { salvarArquivoNota } from "@/lib/nfe/armazenamento";
import type { NotaFiscalExtraida } from "@/lib/nfe/types";
import { normalizarCnpj } from "@/lib/cnpj";

const TAMANHO_MAXIMO_BYTES = 10 * 1024 * 1024; // RNF-003

async function exigirGestor() {
  const session = await auth();
  if (!session?.user || session.user.papel !== "GESTOR") {
    // RF-002/RNF-002 — Notas Fiscais é módulo exclusivo do gestor; a
    // verificação aqui é a que vale de fato, a UI só espelha (defesa em
    // profundidade: nunca confiar só na página estar escondida).
    throw new Error("Acesso restrito ao gestor.");
  }
  return session;
}

export type UploadNotaState = { ok: boolean; message?: string; notaFiscalId?: string };

/** Upload de nota fiscal (RF-014) — extrai e sugere vínculo em seguida. */
export async function uploadNotaFiscal(
  _prevState: UploadNotaState,
  formData: FormData,
): Promise<UploadNotaState> {
  await exigirGestor();

  const arquivo = formData.get("arquivo");
  if (!(arquivo instanceof File) || arquivo.size === 0) {
    return { ok: false, message: "Selecione um arquivo XML ou PDF." };
  }
  if (arquivo.size > TAMANHO_MAXIMO_BYTES) {
    return { ok: false, message: "Arquivo maior que 10MB." };
  }

  const nomeArquivo = arquivo.name.toLowerCase();
  const ehXml = nomeArquivo.endsWith(".xml") || arquivo.type.includes("xml");
  const ehPdf = nomeArquivo.endsWith(".pdf") || arquivo.type === "application/pdf";
  if (!ehXml && !ehPdf) {
    return { ok: false, message: "Formato não suportado — envie um XML ou PDF de nota fiscal." };
  }

  const bytes = Buffer.from(await arquivo.arrayBuffer());

  const nota = await prisma.notaFiscalEntrada.create({
    data: {
      arquivoOriginal: "",
      origemExtracao: ehXml ? "XML_PADRAO" : "IA_ASSISTIDA",
      status: "EM_PROCESSAMENTO",
    },
  });

  try {
    const caminhoArquivo = await salvarArquivoNota(nota.id, ehXml ? "xml" : "pdf", bytes);

    let extraido: NotaFiscalExtraida | null = null;
    let origemExtracaoFinal: "XML_PADRAO" | "IA_ASSISTIDA" = "XML_PADRAO";

    if (ehXml) {
      const texto = bytes.toString("utf-8");
      extraido = parseNfeXml(texto);
      if (!extraido) {
        // XML fora do padrão SEFAZ — aciona fallback via IA (RF-016).
        origemExtracaoFinal = "IA_ASSISTIDA";
        extraido = await parseComIA({ tipo: "xml", texto });
      }
    } else {
      origemExtracaoFinal = "IA_ASSISTIDA";
      extraido = await parseComIA({ tipo: "pdf", bytes });
    }

    if (!extraido || extraido.itens.length === 0) {
      await prisma.notaFiscalEntrada.update({
        where: { id: nota.id },
        data: { arquivoOriginal: caminhoArquivo, status: "ERRO" },
      });
      return {
        ok: false,
        message: "Não foi possível extrair os itens desta nota. Verifique o arquivo.",
      };
    }

    let fornecedorId: string | null = null;
    if (extraido.fornecedor) {
      const cnpj = normalizarCnpj(extraido.fornecedor.cnpj);
      const fornecedor = await prisma.fornecedor.upsert({
        where: { cnpj },
        update: { razaoSocial: extraido.fornecedor.razaoSocial },
        create: { cnpj, razaoSocial: extraido.fornecedor.razaoSocial },
      });
      fornecedorId = fornecedor.id;
    }

    for (const item of extraido.itens) {
      const produtoId = await sugerirVinculoProduto(item);
      await prisma.itemNotaFiscal.create({
        data: {
          notaFiscalId: nota.id,
          produtoId,
          descricaoFornecedor: item.descricaoFornecedor,
          quantidade: item.quantidade,
          custoUnitario: item.custoUnitario,
          ncm: item.ncm,
          numeroLote: item.numeroLote,
          validade: item.validade ? new Date(item.validade) : null,
        },
      });
    }

    await prisma.notaFiscalEntrada.update({
      where: { id: nota.id },
      data: {
        arquivoOriginal: caminhoArquivo,
        fornecedorId,
        chaveAcessoNfe: extraido.chaveAcessoNfe,
        valorTotal: extraido.valorTotal,
        origemExtracao: origemExtracaoFinal,
        status: "PENDENTE_VINCULO",
      },
    });

    revalidatePath("/notas-fiscais");
    return { ok: true, notaFiscalId: nota.id };
  } catch (error) {
    await prisma.notaFiscalEntrada.update({
      where: { id: nota.id },
      data: { status: "ERRO" },
    });
    console.error("Erro ao processar nota fiscal:", error);
    return { ok: false, message: "Erro ao processar a nota. Tente novamente." };
  }
}

export type NotaFiscalResumo = {
  id: string;
  fornecedorNome: string | null;
  valorTotal: number | null;
  status: string;
  origemExtracao: string;
  createdAt: Date;
  totalItens: number;
  itensPendentes: number;
};

export async function listarNotasFiscais(): Promise<NotaFiscalResumo[]> {
  await exigirGestor();

  const notas = await prisma.notaFiscalEntrada.findMany({
    orderBy: { createdAt: "desc" },
    include: { fornecedor: true, itens: { select: { produtoId: true } } },
  });

  return notas.map((nota) => ({
    id: nota.id,
    fornecedorNome: nota.fornecedor?.razaoSocial ?? null,
    valorTotal: nota.valorTotal ? Number(nota.valorTotal) : null,
    status: nota.status,
    origemExtracao: nota.origemExtracao,
    createdAt: nota.createdAt,
    totalItens: nota.itens.length,
    itensPendentes: nota.itens.filter((item) => !item.produtoId).length,
  }));
}

export type ItemNotaDetalhe = {
  id: string;
  descricaoFornecedor: string;
  quantidade: number;
  custoUnitario: number;
  ncm: string | null;
  numeroLote: string | null;
  validade: string | null;
  produtoId: string | null;
  produtoNome: string | null;
  produtoMedicamentoControlado: boolean;
};

export type NotaFiscalDetalhe = {
  id: string;
  fornecedorNome: string | null;
  fornecedorCnpj: string | null;
  valorTotal: number | null;
  status: string;
  origemExtracao: string;
  itens: ItemNotaDetalhe[];
} | null;

export async function buscarNotaFiscal(id: string): Promise<NotaFiscalDetalhe> {
  await exigirGestor();

  const nota = await prisma.notaFiscalEntrada.findUnique({
    where: { id },
    include: {
      fornecedor: true,
      itens: {
        include: { produto: { select: { id: true, nome: true, medicamentoControlado: true } } },
      },
    },
  });
  if (!nota) return null;

  return {
    id: nota.id,
    fornecedorNome: nota.fornecedor?.razaoSocial ?? null,
    fornecedorCnpj: nota.fornecedor?.cnpj ?? null,
    valorTotal: nota.valorTotal ? Number(nota.valorTotal) : null,
    status: nota.status,
    origemExtracao: nota.origemExtracao,
    itens: nota.itens.map((item) => ({
      id: item.id,
      descricaoFornecedor: item.descricaoFornecedor,
      quantidade: Number(item.quantidade),
      custoUnitario: Number(item.custoUnitario),
      ncm: item.ncm,
      numeroLote: item.numeroLote,
      validade: item.validade ? item.validade.toISOString().slice(0, 10) : null,
      produtoId: item.produtoId,
      produtoNome: item.produto?.nome ?? null,
      produtoMedicamentoControlado: item.produto?.medicamentoControlado ?? false,
    })),
  };
}

export type NotaPorChaveState =
  | { ok: true; notaFiscalId: string }
  | { ok: false; message: string; chaveValida: boolean; chaveNormalizada?: string };

/**
 * Bipar o QR da nota (chave de acesso) e abrir a conciliação direto. O QR do
 * DANFE não é a chave pura — é uma URL de consulta (`...?chNFe=<44
 * dígitos>&nVersao=...&tpAmb=...`, formato varia por UF). Por isso a chave é
 * extraída como um bloco contíguo de 44 dígitos, não "tira tudo que não é
 * dígito e confere o tamanho" — isso ia embaralhar a chave com os outros
 * números da URL (nVersao, tpAmb etc.).
 */
export async function buscarNotaPorChave(chave: string): Promise<NotaPorChaveState> {
  await exigirGestor();

  const chaveNormalizada = chave.match(/\d{44}/)?.[0];
  if (!chaveNormalizada) {
    return { ok: false, chaveValida: false, message: "Chave de acesso inválida — precisa ter 44 dígitos." };
  }

  const nota = await prisma.notaFiscalEntrada.findUnique({
    where: { chaveAcessoNfe: chaveNormalizada },
    select: { id: true },
  });
  if (!nota) {
    // A Sefaz não expõe os itens da nota por essa chave — só dá pra saber se
    // já foi enviado o XML dela. Sem o XML, o gestor lança os itens à mão
    // (criarNotaManualPorChave) em vez de ficar bloqueado aqui.
    return {
      ok: false,
      chaveValida: true,
      chaveNormalizada,
      message: "Nenhuma nota com essa chave foi enviada ainda.",
    };
  }

  return { ok: true, notaFiscalId: nota.id };
}

const itemManualSchema = z.object({
  nome: z.string().trim().min(1),
  quantidade: z.coerce.number().positive(),
  custoUnitario: z.coerce.number().nonnegative(),
  codigoBarras: z.string().trim().optional(),
});

const criarNotaManualSchema = z.object({
  chave: z.string().length(44),
  fornecedor: z
    .object({
      razaoSocial: z.string().trim().min(1, "Informe a razão social do fornecedor."),
      cnpj: z.string().trim().min(1, "Informe o CNPJ do fornecedor."),
    })
    .optional(),
  itens: z.array(itemManualSchema).min(1, "Lance ao menos um item."),
});

export type CriarNotaManualInput = z.infer<typeof criarNotaManualSchema>;
export type CriarNotaManualState = { ok: boolean; message?: string; notaFiscalId?: string };

/**
 * RF-014 (via QR) — quando o gestor bipa a chave de acesso mas ainda não
 * enviou o XML dessa nota, lança os itens recebidos à mão em vez de travar:
 * a chave sozinha não dá acesso aos itens (só o portal da Sefaz/o XML têm
 * isso). Segue o mesmo caminho de vínculo automático do upload (RF-017).
 */
export async function criarNotaManualPorChave(input: CriarNotaManualInput): Promise<CriarNotaManualState> {
  await exigirGestor();

  const parsed = criarNotaManualSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  try {
    let fornecedorId: string | null = null;
    if (parsed.data.fornecedor) {
      const cnpj = normalizarCnpj(parsed.data.fornecedor.cnpj);
      const fornecedor = await prisma.fornecedor.upsert({
        where: { cnpj },
        update: { razaoSocial: parsed.data.fornecedor.razaoSocial },
        create: { cnpj, razaoSocial: parsed.data.fornecedor.razaoSocial },
      });
      fornecedorId = fornecedor.id;
    }

    const valorTotal = parsed.data.itens.reduce(
      (acc, item) => acc + item.quantidade * item.custoUnitario,
      0,
    );

    const nota = await prisma.notaFiscalEntrada.create({
      data: {
        chaveAcessoNfe: parsed.data.chave,
        fornecedorId,
        valorTotal,
        arquivoOriginal: "",
        origemExtracao: "MANUAL",
        status: "PENDENTE_VINCULO",
      },
    });

    for (const item of parsed.data.itens) {
      const produtoId = await sugerirVinculoProduto({
        descricaoFornecedor: item.nome,
        quantidade: item.quantidade,
        custoUnitario: item.custoUnitario,
        ncm: null,
        codigoBarras: item.codigoBarras || null,
        numeroLote: null,
        validade: null,
      });
      await prisma.itemNotaFiscal.create({
        data: {
          notaFiscalId: nota.id,
          produtoId,
          descricaoFornecedor: item.nome,
          quantidade: item.quantidade,
          custoUnitario: item.custoUnitario,
        },
      });
    }

    revalidatePath("/notas-fiscais");
    return { ok: true, notaFiscalId: nota.id };
  } catch {
    return { ok: false, message: "Não foi possível lançar a nota manualmente." };
  }
}

const criarProdutoAPartirDoItemSchema = z.object({
  nome: z.string().trim().min(1, "Informe o nome do produto."),
  categoriaId: z.string().uuid("Selecione uma categoria."),
  codigoBarras: z.string().trim().optional(),
  medicamentoControlado: z.boolean().default(false),
});

export type CriarProdutoAPartirDoItemInput = z.infer<typeof criarProdutoAPartirDoItemSchema>;

/**
 * Completa o RF-017 para o caso sem correspondência: cadastra o produto
 * direto do item da nota (reaproveitando o código de barras extraído do XML,
 * quando existir) em vez de obrigar o gestor a já ter cadastrado o produto
 * antes de receber a primeira nota dele.
 */
export async function criarProdutoAPartirDoItem(
  itemId: string,
  dados: CriarProdutoAPartirDoItemInput,
): Promise<AcaoState> {
  await exigirGestor();

  const parsed = criarProdutoAPartirDoItemSchema.safeParse(dados);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  try {
    const item = await prisma.itemNotaFiscal.findUnique({
      where: { id: itemId },
      select: { notaFiscal: { select: { status: true } } },
    });
    if (!item || item.notaFiscal.status === "CONCILIADA") {
      return { ok: false, message: "Nota já conciliada — vínculo não pode mais ser alterado." };
    }

    const produto = await prisma.produto.create({
      data: {
        nome: parsed.data.nome,
        categoriaId: parsed.data.categoriaId,
        codigoBarras: parsed.data.codigoBarras || null,
        medicamentoControlado: parsed.data.medicamentoControlado,
      },
    });

    await prisma.itemNotaFiscal.update({ where: { id: itemId }, data: { produtoId: produto.id } });
    revalidatePath("/notas-fiscais");
    return { ok: true };
  } catch {
    return { ok: false, message: "Não foi possível cadastrar o produto." };
  }
}

export type AcaoState = { ok: boolean; message?: string };

const loteItemSchema = z.object({
  numeroLote: z.string().trim().min(1, "Informe o número do lote."),
  validade: z.string().refine((v) => !Number.isNaN(Date.parse(v)), "Data de validade inválida."),
});

/** RN-014 — lote/validade informados manualmente quando o XML não trouxe. */
export async function atualizarLoteItem(
  itemId: string,
  dados: { numeroLote: string; validade: string },
): Promise<AcaoState> {
  await exigirGestor();

  const parsed = loteItemSchema.safeParse(dados);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  try {
    const item = await prisma.itemNotaFiscal.findUnique({
      where: { id: itemId },
      select: { notaFiscal: { select: { status: true } } },
    });
    if (!item || item.notaFiscal.status === "CONCILIADA") {
      return { ok: false, message: "Nota já conciliada — lote não pode mais ser alterado." };
    }

    await prisma.itemNotaFiscal.update({
      where: { id: itemId },
      data: { numeroLote: parsed.data.numeroLote, validade: new Date(parsed.data.validade) },
    });
    revalidatePath("/notas-fiscais");
    return { ok: true };
  } catch {
    return { ok: false, message: "Não foi possível salvar o lote." };
  }
}

/** Vínculo manual de item a produto (RF-017). */
export async function vincularItemNota(itemId: string, produtoId: string | null): Promise<AcaoState> {
  await exigirGestor();

  try {
    const item = await prisma.itemNotaFiscal.findUnique({
      where: { id: itemId },
      select: { notaFiscal: { select: { status: true } } },
    });
    if (!item || item.notaFiscal.status === "CONCILIADA") {
      return { ok: false, message: "Nota já conciliada — vínculo não pode mais ser alterado." };
    }

    await prisma.itemNotaFiscal.update({ where: { id: itemId }, data: { produtoId } });
    revalidatePath("/notas-fiscais");
    return { ok: true };
  } catch {
    return { ok: false, message: "Não foi possível vincular o item." };
  }
}

/**
 * Concilia a nota fiscal (RF-018): exige todos os itens vinculados, incrementa
 * o estoque de cada produto (RF-006) e trava o custo com o valor desta nota
 * (RN-008 — sempre a compra mais recente conciliada, nunca média).
 */
export async function conciliarNotaFiscal(notaFiscalId: string): Promise<AcaoState> {
  await exigirGestor();

  try {
    await prisma.$transaction(async (tx) => {
      const nota = await tx.notaFiscalEntrada.findUnique({
        where: { id: notaFiscalId },
        include: { itens: { include: { produto: { select: { medicamentoControlado: true } } } } },
      });
      if (!nota) throw new Error("Nota fiscal não encontrada.");
      if (nota.status === "CONCILIADA") throw new Error("Nota já conciliada.");
      if (nota.itens.some((item) => !item.produtoId)) {
        // RN-007 — itens pendentes de vínculo bloqueiam a conciliação da nota.
        throw new Error("Existem itens sem vínculo com um produto.");
      }
      if (nota.itens.some((item) => item.produto?.medicamentoControlado && !item.numeroLote)) {
        // RN-014 — item de produto controlado exige lote/validade antes de conciliar.
        throw new Error("Existem itens de medicamento controlado sem lote e validade.");
      }

      for (const item of nota.itens) {
        const quantidade = Math.round(Number(item.quantidade));

        await tx.produto.update({
          where: { id: item.produtoId! },
          data: {
            quantidadeEstoque: { increment: quantidade },
            custoTravado: item.custoUnitario,
          },
        });

        if (item.numeroLote && item.validade) {
          // RN-015 — soma no lote (por produto+número), criando se for a
          // primeira entrada desse lote.
          await tx.loteProduto.upsert({
            where: { produtoId_numeroLote: { produtoId: item.produtoId!, numeroLote: item.numeroLote } },
            update: { quantidade: { increment: quantidade } },
            create: {
              produtoId: item.produtoId!,
              numeroLote: item.numeroLote,
              validade: item.validade,
              quantidade,
            },
          });
        }
      }

      await tx.notaFiscalEntrada.update({
        where: { id: notaFiscalId },
        data: { status: "CONCILIADA", conciliadaEm: new Date() },
      });
    });

    revalidatePath("/notas-fiscais");
    revalidatePath(`/notas-fiscais/${notaFiscalId}`);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Não foi possível conciliar a nota.",
    };
  }
}
