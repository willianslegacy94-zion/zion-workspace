import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { RelatoriosClient } from "@/components/relatorios/RelatoriosClient";

export default async function RelatoriosPage() {
  const session = await auth();
  if (session?.user?.papel !== "GESTOR") {
    // RF-002/RNF-002 — volume e receita de vendas são dado exclusivo do gestor.
    redirect("/pdv");
  }

  return <RelatoriosClient />;
}
