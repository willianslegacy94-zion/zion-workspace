import { NextResponse } from "next/server";
import {
  RecuperacaoSenhaError,
  solicitarRecuperacao,
} from "@/lib/recuperacao-senha";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  try {
    const resultado = await solicitarRecuperacao(
      String(body.email ?? ""),
      new URL(request.url).origin,
    );
    return NextResponse.json(resultado);
  } catch (error) {
    if (error instanceof RecuperacaoSenhaError) {
      return NextResponse.json({ erro: error.message }, { status: error.status });
    }
    throw error;
  }
}
