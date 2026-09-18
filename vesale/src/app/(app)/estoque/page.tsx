import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listarCategorias, listarProdutosEstoque } from "@/server/actions/estoque";
import { EstoqueClient } from "@/components/estoque/EstoqueClient";

export default async function EstoquePage() {
  const session = await auth();
  if (session?.user?.papel !== "GESTOR") {
    // RF-002 — cadastro e custo são exclusivos do gestor.
    redirect("/pdv");
  }

  const [produtos, categorias] = await Promise.all([listarProdutosEstoque(), listarCategorias()]);

  return <EstoqueClient produtosIniciais={produtos} categorias={categorias} />;
}
