import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listarFornecedores } from "@/server/actions/fornecedores";
import { FornecedoresClient } from "@/components/fornecedores/FornecedoresClient";

export default async function FornecedoresPage() {
  const session = await auth();
  if (session?.user?.papel !== "GESTOR") {
    // RF-002 — cadastro de fornecedor é exclusivo do gestor.
    redirect("/pdv");
  }

  const fornecedores = await listarFornecedores();

  return <FornecedoresClient fornecedoresIniciais={fornecedores} />;
}
