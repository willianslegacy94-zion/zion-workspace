import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listarPrecificacao } from "@/server/actions/rentabilidade";
import { RentabilidadeClient } from "@/components/rentabilidade/RentabilidadeClient";

export default async function RentabilidadePage() {
  const session = await auth();
  if (session?.user?.papel !== "GESTOR") {
    // RF-002/RNF-002 — precificação e CMV são exclusivos do gestor.
    redirect("/pdv");
  }

  const produtos = await listarPrecificacao();

  return <RentabilidadeClient produtosIniciais={produtos} />;
}
