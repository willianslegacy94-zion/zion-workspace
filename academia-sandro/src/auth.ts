import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

const PROTECTED_PATHS = [
  "/alunos",
  "/transacoes",
  "/agenda",
  "/despesas",
  "/pre-cadastros",
];

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

        return { id: usuario.id, username: usuario.username };
      },
    }),
  ],
  callbacks: {
    authorized({ auth, request }) {
      const logado = !!auth?.user;
      const { pathname } = request.nextUrl;
      const protegida =
        pathname === "/" ||
        PROTECTED_PATHS.some((path) => pathname.startsWith(path));
      return !protegida || logado;
    },
    jwt({ token, user }) {
      if (user) {
        token.username = (user as { username: string }).username;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.username = token.username as string;
      }
      return session;
    },
  },
});
