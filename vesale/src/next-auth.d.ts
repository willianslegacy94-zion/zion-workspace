import type { DefaultSession } from "next-auth";

type Papel = "GESTOR" | "OPERADOR_CAIXA";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      papel: Papel;
    } & DefaultSession["user"];
  }

  interface User {
    papel?: Papel;
  }
}
