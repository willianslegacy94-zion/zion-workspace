"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { normalizarCnpj } from "@/lib/cnpj";

async function exigirGestor() {
  const session = await auth();
  if (!session?.user || session.user.papel !== "GESTOR") {
    // RF-002/RNF-002 — cadastro de fornecedor é exclusivo do gestor, mesma
    // regra do resto do Módulo 4 (Notas Fiscais).
    throw new Error("Acesso restrito ao gestor.");
  }
  return session;
}

function ehCnpjDuplicado(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export type FornecedorResumo = {
  id: string;
  razaoSocial: string;
  cnpj: string;
  totalPedidos: number;
  valorTotalPedidos: number;
  ultimoPedidoEm: string | null;
};

/** RF-031 — lista fornecedores, com total de pedidos/valor e data do último. */
export async function listarFornecedores(): Promise<FornecedorResumo[]> {
  await exigirGestor();

  const fornecedores = await prisma.fornecedor.findMany({
    include: {
      notasFiscais: {
        select: { valorTotal: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      },
    },
    orderBy: { razaoSocial: "asc" },
  });

  return fornecedores.map((f) => ({
    id: f.id,
    razaoSocial: f.razaoSocial,
    cnpj: f.cnpj,
    totalPedidos: f.notasFiscais.length,
    valorTotalPedidos: f.notasFiscais.reduce(
      (acc, n) => acc + (n.valorTotal ? Number(n.valorTotal) : 0),
      0,
    ),
    ultimoPedidoEm: f.notasFiscais[0]?.createdAt.toISOString() ?? null,
  }));
}

const fornecedorSchema = z.object({
  razaoSocial: z.string().trim().min(1, "Informe a razão social."),
  cnpj: z
    .string()
    .trim()
    .transform(normalizarCnpj)
    .refine((v) => v.length === 14, "CNPJ precisa ter 14 dígitos."),
});

export type FornecedorFormState = { ok: boolean; message?: string };

/** RF-031 — cadastra fornecedor direto (sem precisar vir de uma nota fiscal). */
export async function criarFornecedor(
  _prevState: FornecedorFormState,
  formData: FormData,
): Promise<FornecedorFormState> {
  try {
    await exigirGestor();
    const parsed = fornecedorSchema.safeParse({
      razaoSocial: formData.get("razaoSocial"),
      cnpj: formData.get("cnpj"),
    });
    if (!parsed.success) {
      return { ok: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos." };
    }

    await prisma.fornecedor.create({ data: parsed.data });
    revalidatePath("/fornecedores");
    return { ok: true };
  } catch (error) {
    if (ehCnpjDuplicado(error)) {
      return { ok: false, message: "Já existe um fornecedor com esse CNPJ." };
    }
    return { ok: false, message: "Não foi possível cadastrar o fornecedor." };
  }
}

/** RF-031 — edita razão social/CNPJ de um fornecedor existente. */
export async function atualizarFornecedor(
  fornecedorId: string,
  _prevState: FornecedorFormState,
  formData: FormData,
): Promise<FornecedorFormState> {
  try {
    await exigirGestor();
    const parsed = fornecedorSchema.safeParse({
      razaoSocial: formData.get("razaoSocial"),
      cnpj: formData.get("cnpj"),
    });
    if (!parsed.success) {
      return { ok: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos." };
    }

    await prisma.fornecedor.update({ where: { id: fornecedorId }, data: parsed.data });
    revalidatePath("/fornecedores");
    return { ok: true };
  } catch (error) {
    if (ehCnpjDuplicado(error)) {
      return { ok: false, message: "Já existe um fornecedor com esse CNPJ." };
    }
    return { ok: false, message: "Não foi possível atualizar o fornecedor." };
  }
}
