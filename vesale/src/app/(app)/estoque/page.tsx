import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listarCategorias, listarProdutosEstoque } from "@/server/actions/estoque";
import { EstoqueClient } from "@/components/estoque/EstoqueClient";

export default async function EstoquePage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const [produtos, categorias] = await Promise.all([listarProdutosEstoque(), listarCategorias()]);

  // Operador de caixa só consulta (preço de venda); cadastro/edição e custo
  // travado seguem exclusivos do gestor (RF-002).
  return <EstoqueClient produtosIniciais={produtos} categorias={categorias} papel={session.user.papel} />;
}
