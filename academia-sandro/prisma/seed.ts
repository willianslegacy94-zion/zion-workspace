import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma";

// Senha padrão para usuários recém-criados. Sempre marcada como temporária —
// o fluxo esperado é o próprio usuário pedir redefinição via /esqueci-senha.
const SENHA_PADRAO = "academia2026";

async function main() {
  const username = process.env.ADMIN_USERNAME?.trim();
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();

  if (!username || !email) {
    throw new Error(
      "Defina ADMIN_USERNAME e ADMIN_EMAIL no .env antes de rodar o seed.",
    );
  }

  const passwordHash = await bcrypt.hash(SENHA_PADRAO, 12);

  const usuario = await prisma.usuario.upsert({
    where: { username },
    update: { email, role: "ADMIN", nome: "Mestre Sandro" },
    create: {
      username,
      email,
      passwordHash,
      role: "ADMIN",
      nome: "Mestre Sandro",
      senhaTemporaria: true,
    },
  });

  console.log(
    `Usuário "${usuario.username}" criado/atualizado. Senha padrão: "${SENHA_PADRAO}" (temporária — peça redefinição via /esqueci-senha).`,
  );

  await garantirContasFixas();
}

// Contas fixas de teste/suporte (devaluno + devmaster) — devem sobreviver a
// qualquer re-seed, inclusive em produção, para diagnóstico do Willians.
const SENHA_DEV = "dev1807194";

async function garantirContasFixas() {
  const passwordHash = await bcrypt.hash(SENHA_DEV, 12);

  await prisma.usuario.upsert({
    where: { username: "devmaster" },
    update: {
      passwordHash,
      role: "ADMIN",
      nome: "Dev Master (Suporte)",
      senhaTemporaria: false,
    },
    create: {
      username: "devmaster",
      email: "devmaster@sistema.local",
      nome: "Dev Master (Suporte)",
      role: "ADMIN",
      passwordHash,
      senhaTemporaria: false,
    },
  });

  const devaluno = await prisma.usuario.findUnique({
    where: { username: "devaluno" },
  });

  if (devaluno) {
    await prisma.usuario.update({
      where: { username: "devaluno" },
      data: { passwordHash, senhaTemporaria: false },
    });
  } else {
    const aluno = await prisma.aluno.create({
      data: {
        nome: "Aluno Teste (Dev)",
        modalidade: "Jiu-Jitsu",
        graduacaoFaixa: "Branca",
        statusPagamento: "Em dia",
      },
    });
    await prisma.usuario.create({
      data: {
        username: "devaluno",
        email: "devaluno@sistema.local",
        nome: "Aluno Teste (Dev)",
        role: "ALUNO",
        passwordHash,
        senhaTemporaria: false,
        alunoId: aluno.id,
      },
    });
  }

  console.log(
    `Contas fixas "devaluno" e "devmaster" garantidas. Senha: "${SENHA_DEV}".`,
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
