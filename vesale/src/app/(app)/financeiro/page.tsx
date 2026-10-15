import { redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  buscarResumoCaixa,
  listarCategoriasFinanceiras,
  listarContasFinanceiras,
} from "@/server/actions/financeiro";
import { FinanceiroClient } from "@/components/financeiro/FinanceiroClient";

export default async function FinanceiroPage() {
  const session = await auth();
  if (session?.user?.papel !== "GESTOR") {
    // RF-002/RNF-002 — Financeiro é módulo exclusivo do gestor.
    redirect("/pdv");
  }

  const [contas, categorias, resumoCaixa] = await Promise.all([
    listarContasFinanceiras(),
    listarCategoriasFinanceiras(),
    buscarResumoCaixa(),
  ]);

  return <FinanceiroClient contasIniciais={contas} categorias={categorias} resumoCaixa={resumoCaixa} />;
}
