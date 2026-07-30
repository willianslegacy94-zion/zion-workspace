import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

// Telas de gestão — exigem role ADMIN.
const ADMIN_PATHS = [
  "/alunos",
  "/transacoes",
  "/agenda",
  "/despesas",
  "/pre-cadastros",
  "/matriculas",
  "/configuracoes",
];

// Portal do aluno — exige role ALUNO.
const ALUNO_PATHS = ["/aluno"];

// Match por segmento exato — evita que "/alunos" (gestão) colida com "/aluno" (portal).
function pathEmGrupo(pathname: string, prefixos: string[]) {
  return prefixos.some(
    (prefixo) => pathname === prefixo || pathname.startsWith(`${prefixo}/`),
  );
}

// Hash bcrypt de uma string qualquer, usado só para manter o tempo de resposta
// constante quando o usuário não existe (mitigação de timing attack).
const DUMMY_HASH =
  "$2b$12$YSsom1pzFqTyQ9QM9BueC.WEhIc1caPs/9R.DK5ZkeFoO0MDcscMm";

export const { handlers, signIn, signOut, auth } = NextAuth({
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      credentials: {
        username: { label: "Usuário", type: "text" },
        password: { label: "Senha", type: "password" },
      },
      authorize: async (credentials) => {
        const username = String(credentials?.username ?? "").trim();
        const password = String(credentials?.password ?? "");

        if (!username || !password) return null;

        const usuario = await prisma.usuario.findUnique({
          where: { username },
        });

        const senhaValida = await bcrypt.compare(
          password,
          usuario?.passwordHash ?? DUMMY_HASH,
        );

        if (!usuario || !senhaValida) return null;

        return {
          id: usuario.id,
          username: usuario.username,
          nome: usuario.nome,
          role: usuario.role,
          alunoId: usuario.alunoId,
        };
      },
    }),
  ],
  callbacks: {
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const rotaAdmin =
        pathname === "/" || pathEmGrupo(pathname, ADMIN_PATHS);
      const rotaAluno = pathEmGrupo(pathname, ALUNO_PATHS);

      if (!rotaAdmin && !rotaAluno) return true;
      if (!auth?.user) return false;

      const role = auth.user.role;

      if (rotaAdmin && role !== "ADMIN") {
        return NextResponse.redirect(new URL("/aluno", request.url));
      }
      if (rotaAluno && role !== "ALUNO") {
        return NextResponse.redirect(new URL("/", request.url));
      }
      return true;
    },
    jwt({ token, user }) {
      if (user) {
        const u = user as {
          id: string;
          username: string;
          nome: string | null;
          role: string;
          alunoId: string | null;
        };
        token.id = u.id;
        token.username = u.username;
        token.nome = u.nome;
        token.role = u.role;
        token.alunoId = u.alunoId;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.username = token.username as string;
        session.user.nome = token.nome as string | null;
        session.user.role = token.role as string;
        session.user.alunoId = token.alunoId as string | null;
      }
      return session;
    },
  },
});
