import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

// Hash bcrypt de uma string qualquer, usado só para manter o tempo de resposta
// constante quando o e-mail informado não existe (mitigação de timing attack).
const DUMMY_HASH =
  "$2b$12$YSsom1pzFqTyQ9QM9BueC.WEhIc1caPs/9R.DK5ZkeFoO0MDcscMm";

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "E-mail", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      authorize: async (credentials) => {
        const email = String(credentials?.email ?? "")
          .trim()
          .toLowerCase();
        const password = String(credentials?.password ?? "");

        if (!email || !password) return null;

        const usuario = await prisma.usuario.findUnique({ where: { email } });

        const senhaValida = await bcrypt.compare(
          password,
          usuario?.senhaHash ?? DUMMY_HASH,
        );

        if (!usuario || !senhaValida) return null;

        return {
          id: usuario.id,
          email: usuario.email,
          name: usuario.nome,
          papel: usuario.papel,
        };
      },
    }),
  ],
  callbacks: {
    authorized({ auth, request }) {
      // Todas as rotas cobertas pelo matcher de src/proxy.ts exigem sessão —
      // sem isso, o proxy apenas anexa `auth` ao request e deixa passar.
      if (auth?.user) return true;

      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("callbackUrl", request.nextUrl.pathname);
      return NextResponse.redirect(loginUrl);
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.papel = user.papel;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.papel =
          (token.papel as "GESTOR" | "OPERADOR_CAIXA" | undefined) ?? "OPERADOR_CAIXA";
      }
      return session;
    },
  },
});
