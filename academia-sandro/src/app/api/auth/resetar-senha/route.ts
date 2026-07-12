import { NextResponse } from "next/server";
import { RecuperacaoSenhaError, resetarSenha } from "@/lib/recuperacao-senha";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  try {
    await resetarSenha(String(body.token ?? ""), String(body.novaSenha ?? ""));
    return NextResponse.json({ mensagem: "Senha atualizada com sucesso." });
  } catch (error) {
    if (error instanceof RecuperacaoSenhaError) {
      return NextResponse.json({ erro: error.message }, { status: error.status });
    }
    throw error;
  }
}
