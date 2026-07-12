export { auth as proxy } from "@/auth";

export const config = {
  matcher: [
    "/",
    "/alunos/:path*",
    "/transacoes/:path*",
    "/agenda/:path*",
    "/despesas/:path*",
    "/pre-cadastros/:path*",
  ],
};
