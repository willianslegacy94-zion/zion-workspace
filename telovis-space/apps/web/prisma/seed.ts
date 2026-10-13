// Dados de desenvolvimento: um space "hq" no banco (reaproveita o mapa do
// demo) e três contas para testar o controle de acesso. Idempotente.
//
//   admin@telovis.local  — dono do hq (ADMIN)
//   ana@telovis.local    — MEMBER do hq
//   bruno@telovis.local  — sem vínculo: só entra no demo
//
// Senha de todos: telovis123
import "dotenv/config";
import { hashPassword } from "../src/lib/auth/password";
import { prisma } from "../src/lib/prisma";

const PASSWORD = "telovis123";

async function upsertUser(email: string, name: string, passwordHash: string) {
  return prisma.user.upsert({
    where: { email },
    update: { name },
    create: { email, name, passwordHash },
  });
}

async function main() {
  const passwordHash = await hashPassword(PASSWORD);
  const admin = await upsertUser("admin@telovis.local", "Admin", passwordHash);
  const ana = await upsertUser("ana@telovis.local", "Ana", passwordHash);
  await upsertUser("bruno@telovis.local", "Bruno", passwordHash);

  const hq = await prisma.space.upsert({
    where: { slug: "hq" },
    update: {},
    create: {
      slug: "hq",
      name: "TeloVis HQ",
      mapJsonUrl: "/assets/maps/office.json",
      tilesetUrl: "/assets/tilesets/office-tiles.png",
      ownerId: admin.id,
    },
  });

  await prisma.spaceMember.upsert({
    where: { userId_spaceId: { userId: ana.id, spaceId: hq.id } },
    update: {},
    create: { userId: ana.id, spaceId: hq.id, role: "MEMBER" },
  });

  console.log(`seed ok — space "hq", contas *@telovis.local, senha ${PASSWORD}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
