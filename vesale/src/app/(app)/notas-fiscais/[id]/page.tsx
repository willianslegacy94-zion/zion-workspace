import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { buscarNotaFiscal } from "@/server/actions/notas-fiscais";
import { listarCategorias } from "@/server/actions/estoque";
import { ConciliacaoClient } from "@/components/notas-fiscais/ConciliacaoClient";

export default async function NotaFiscalDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (session?.user?.papel !== "GESTOR") {
    redirect("/pdv");
  }

  const { id } = await params;
  const [nota, categorias] = await Promise.all([buscarNotaFiscal(id), listarCategorias()]);
  if (!nota) notFound();

  return (
    <div className="mx-auto flex max-w-[1500px] flex-col gap-4 p-4 md:p-7">
      <div>
        <h1 className="text-lg font-semibold text-vesale-ink">
          {nota.fornecedorNome ?? "Fornecedor não identificado"}
        </h1>
        {nota.fornecedorCnpj && <p className="text-sm text-vesale-muted">CNPJ {nota.fornecedorCnpj}</p>}
      </div>

      <ConciliacaoClient
        notaFiscalId={nota.id}
        itensIniciais={nota.itens}
        categorias={categorias}
        jaConciliada={nota.status === "CONCILIADA"}
      />
    </div>
  );
}
