import { unlink } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";

const DIAS_RETENCAO = 10;

// Comprovantes anexados pelos alunos ficam só 10 dias no sistema (arquivo +
// referência), pra não acumular espaço em disco indefinidamente. Chamada de
// forma "preguiçosa" nas telas que exibem comprovante — sem cron configurado,
// roda quando alguém abre essas telas. Também exposta via /api/cron para
// quem quiser agendar de verdade (Vercel Cron, cron do sistema, etc.).
export async function limparComprovantesExpirados(): Promise<number> {
  const limite = new Date();
  limite.setDate(limite.getDate() - DIAS_RETENCAO);

  const expirados = await prisma.transacaoFinanceira.findMany({
    where: {
      comprovanteUrl: { not: null },
      comprovanteEnviadoEm: { lt: limite },
    },
    select: { id: true, comprovanteUrl: true },
  });

  for (const transacao of expirados) {
    if (transacao.comprovanteUrl) {
      const caminho = path.join(process.cwd(), "public", transacao.comprovanteUrl);
      await unlink(caminho).catch(() => {});
    }
    await prisma.transacaoFinanceira.update({
      where: { id: transacao.id },
      data: { comprovanteUrl: null, comprovanteEnviadoEm: null },
    });
  }

  return expirados.length;
}
