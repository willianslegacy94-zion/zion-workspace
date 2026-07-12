"use server";

import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function proximaData(data: Date, frequencia: string): Date {
  const proxima = new Date(data);
  if (frequencia === "Semanal") {
    proxima.setDate(proxima.getDate() + 7);
  } else if (frequencia === "Anual") {
    proxima.setFullYear(proxima.getFullYear() + 1);
  } else {
    proxima.setMonth(proxima.getMonth() + 1);
  }
  return proxima;
}

export async function createDespesa(formData: FormData) {
  const categoria = String(formData.get("categoria") ?? "").trim();
  const descricao = String(formData.get("descricao") ?? "").trim();
  const valor = String(formData.get("valor") ?? "").trim();
  const data = String(formData.get("data") ?? "").trim();
  const recorrente = formData.get("recorrente") === "on";
  const frequenciaRecorrencia = String(
    formData.get("frequenciaRecorrencia") ?? "",
  ).trim();

  if (!categoria || !descricao || !valor || !data) {
    throw new Error("Preencha todos os campos obrigatórios.");
  }
  if (recorrente && !frequenciaRecorrencia) {
    throw new Error("Selecione a frequência da recorrência.");
  }

  const grupoRecorrenciaId = recorrente ? crypto.randomUUID() : null;
  const ocorrencias = recorrente ? 12 : 1;

  const registros: {
    categoria: string;
    descricao: string;
    valor: string;
    data: Date;
    recorrente: boolean;
    frequenciaRecorrencia: string | null;
    grupoRecorrenciaId: string | null;
  }[] = [];

  let dataAtual = new Date(data);
  for (let i = 0; i < ocorrencias; i++) {
    registros.push({
      categoria,
      descricao,
      valor,
      data: dataAtual,
      recorrente,
      frequenciaRecorrencia: recorrente ? frequenciaRecorrencia : null,
      grupoRecorrenciaId,
    });
    if (recorrente) {
      dataAtual = proximaData(dataAtual, frequenciaRecorrencia);
    }
  }

  await prisma.despesa.createMany({ data: registros });

  revalidatePath("/despesas");
}

export async function updateDespesa(id: string, formData: FormData) {
  const categoria = String(formData.get("categoria") ?? "").trim();
  const descricao = String(formData.get("descricao") ?? "").trim();
  const valor = String(formData.get("valor") ?? "").trim();
  const data = String(formData.get("data") ?? "").trim();

  if (!categoria || !descricao || !valor || !data) {
    throw new Error("Preencha todos os campos obrigatórios.");
  }

  await prisma.despesa.update({
    where: { id },
    data: {
      categoria,
      descricao,
      valor,
      data: new Date(data),
    },
  });

  revalidatePath("/despesas");
  redirect("/despesas");
}

export async function deleteDespesa(id: string) {
  await prisma.despesa.delete({ where: { id } });
  revalidatePath("/despesas");
}
