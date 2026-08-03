import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { gerarLinkAcesso } from "@/lib/recuperacao-senha";

export async function gerarUsernameUnico(nome: string): Promise<string> {
  const partes = nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .split(/\s+/);
  const base = `${partes[0]}.${partes[partes.length - 1]}`;

  let candidato = base;
  let sufixo = 1;
  while (await prisma.usuario.findUnique({ where: { username: candidato } })) {
    sufixo++;
    candidato = `${base}${sufixo}`;
  }
  return candidato;
}

export async function criarUsuarioAluno({
  alunoId,
  username,
  email,
  origin,
}: {
  alunoId: string;
  username: string;
  email: string;
  origin: string;
}): Promise<string> {
  const senhaAleatoria = crypto.randomBytes(24).toString("hex");
  const passwordHash = await bcrypt.hash(senhaAleatoria, 12);

  const usuario = await prisma.usuario.create({
    data: {
      username,
      email,
      passwordHash,
      role: "ALUNO",
      senhaTemporaria: true,
      alunoId,
    },
  });

  return gerarLinkAcesso(usuario.id, origin);
}
