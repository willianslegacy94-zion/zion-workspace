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
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
