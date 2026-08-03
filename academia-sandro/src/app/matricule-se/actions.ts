"use server";

import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { enviarWhatsapp } from "@/lib/whatsapp-gateway";

export async function criarPreCadastro(formData: FormData) {
  const nome = String(formData.get("nome") ?? "").trim();
  const idadeRaw = String(formData.get("idade") ?? "").trim();
  const dataNascimentoRaw = String(formData.get("dataNascimento") ?? "").trim();
  const telefone = String(formData.get("telefone") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const cidade = String(formData.get("cidade") ?? "").trim();
  const lesoes = String(formData.get("lesoes") ?? "").trim();
  const modalidadeInteresse = String(formData.get("modalidadeInteresse") ?? "").trim();
  const dataAulaExperimentalRaw = String(formData.get("dataAulaExperimental") ?? "").trim();
  const termosAceitos = formData.get("termosAceitos") === "on";

  if (!nome || !telefone) {
    throw new Error("Preencha nome e telefone.");
  }
  if (!termosAceitos) {
    throw new Error("É preciso aceitar os termos de uso e a política de privacidade.");
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
      dataAulaExperimental: dataAulaExperimentalRaw ? new Date(dataAulaExperimentalRaw) : null,
      termosAceitos: true,
      termosAceitosEm: new Date(),
    },
  });

  // Aula experimental agendada = avisa o admin no WhatsApp automaticamente
  // (sem clique manual — ver src/lib/whatsapp-gateway.ts). Falha de envio
  // nunca bloqueia o pré-cadastro em si.
  if (dataAulaExperimentalRaw) {
    const admin = await prisma.usuario.findUnique({
      where: { username: process.env.ADMIN_USERNAME },
      select: { telefone: true },
    });
    if (admin?.telefone) {
      const dataFormatada = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(
        new Date(dataAulaExperimentalRaw),
      );
      const modalidadeTexto = modalidadeInteresse || "modalidade a definir";
      await enviarWhatsapp(
        admin.telefone,
        `🥋 Nova aula experimental agendada!\n${nome} (${telefone}) quer conhecer ${modalidadeTexto} no dia ${dataFormatada}.`,
      );
    }
  }

  redirect("/matricule-se?sucesso=1");
}
