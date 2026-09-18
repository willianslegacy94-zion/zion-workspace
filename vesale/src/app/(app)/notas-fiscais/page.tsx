import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listarNotasFiscais } from "@/server/actions/notas-fiscais";
import { UploadNotaForm } from "@/components/notas-fiscais/UploadNotaForm";
import { BuscarPorChaveForm } from "@/components/notas-fiscais/BuscarPorChaveForm";
import { formatBRL } from "@/lib/currency";

const STATUS_LABEL: Record<string, string> = {
  RECEBIDA: "Recebida",
  EM_PROCESSAMENTO: "Processando",
  PENDENTE_VINCULO: "Pendente de vínculo",
  CONCILIADA: "Conciliada",
  ERRO: "Erro",
};

const STATUS_COR: Record<string, string> = {
  RECEBIDA: "bg-vesale-muted/10 text-vesale-muted",
  EM_PROCESSAMENTO: "bg-vesale-muted/10 text-vesale-muted",
  PENDENTE_VINCULO: "bg-vesale-warning/10 text-vesale-warning",
  CONCILIADA: "bg-vesale-success/10 text-vesale-success",
  ERRO: "bg-vesale-red/10 text-vesale-red",
};

export default async function NotasFiscaisPage() {
  const session = await auth();
  if (session?.user?.papel !== "GESTOR") {
    // RF-002 — tela exclusiva do gestor; operador de caixa nunca a alcança.
    redirect("/pdv");
  }

  const notas = await listarNotasFiscais();

  return (
    <div className="mx-auto flex max-w-[1500px] flex-col gap-4 p-4 md:p-7">
      <h1 className="text-lg font-semibold text-vesale-ink">Notas Fiscais de Entrada</h1>

      <UploadNotaForm />
      <BuscarPorChaveForm />

      <div className="rounded-2xl border border-vesale-border bg-vesale-surface">
        {notas.length === 0 ? (
          <p className="p-8 text-center text-sm text-vesale-muted">Nenhuma nota fiscal enviada ainda.</p>
        ) : (
          <ul className="divide-y divide-vesale-border">
            {notas.map((nota) => (
              <li key={nota.id}>
                <Link
                  href={`/notas-fiscais/${nota.id}`}
                  className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-vesale-bg"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-vesale-ink">
                      {nota.fornecedorNome ?? "Fornecedor não identificado"}
                    </p>
                    <p className="text-xs text-vesale-muted">
                      {nota.totalItens} {nota.totalItens === 1 ? "item" : "itens"}
                      {nota.itensPendentes > 0 && ` · ${nota.itensPendentes} sem vínculo`}
                      {" · "}
                      {nota.createdAt.toLocaleDateString("pt-BR")}
                    </p>
                  </div>

                  <span className="text-sm font-semibold text-vesale-ink">
                    {nota.valorTotal !== null ? formatBRL(nota.valorTotal) : "—"}
                  </span>

                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_COR[nota.status] ?? ""}`}
                  >
                    {STATUS_LABEL[nota.status] ?? nota.status}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
