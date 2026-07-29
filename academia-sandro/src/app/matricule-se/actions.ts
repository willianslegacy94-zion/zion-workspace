"use server";

import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export async function criarPreCadastro(formData: FormData) {
  const nome = String(formData.get("nome") ?? "").trim();
  const idadeRaw = String(formData.get("idade") ?? "").trim();
  const dataNascimentoRaw = String(formData.get("dataNascimento") ?? "").trim();
  const telefone = String(formData.get("telefone") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const cidade = String(formData.get("cidade") ?? "").trim();
  const lesoes = String(formData.get("lesoes") ?? "").trim();
  const modalidadeInteresse = String(formData.get("modalidadeInteresse") ?? "").trim();

  if (!nome || !telefone) {
    throw new Error("Preencha nome e telefone.");
  }

  await prisma.preCadastro.create({
    data: {
      nome,
      idade: idadeRaw ? Number(idadeRaw) : null,
      dataNascimento: dataNascimentoRaw ? new Date(dataNascimentoRaw) : null,
      telefone,
      email: email || null,
      cidade: cidade || null,
      lesoes: lesoes || null,
      modalidadeInteresse: modalidadeInteresse || null,
    },
  });

  redirect("/matricule-se?sucesso=1");
}
