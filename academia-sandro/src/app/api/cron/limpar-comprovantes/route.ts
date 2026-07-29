import { NextResponse } from "next/server";
import { limparComprovantesExpirados } from "@/lib/comprovantes";

// Rota pronta pra agendar num cron de verdade (Vercel Cron, cron do sistema
// operacional com curl, etc.) — sem isso configurado, a limpeza já roda de
// forma preguiçosa quando o admin abre /matriculas ou /transacoes.
export async function GET() {
  const removidos = await limparComprovantesExpirados();
  return NextResponse.json({ removidos });
}
