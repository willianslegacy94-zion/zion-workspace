import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { buscarResumoDashboard } from "@/server/actions/dashboard";
import { formatBRL } from "@/lib/currency";

function KpiCard({
  label,
  value,
  sub,
  accent,
  href,
}: {
  label: string;
  value: string;
  sub: string;
  accent: string;
  href?: string;
}) {
  const conteudo = (
    <div className="flex gap-3 rounded-2xl border border-vesale-border bg-vesale-surface p-4">
      <div className={`w-1 shrink-0 self-stretch rounded ${accent}`} />
      <div>
        <p className="mb-1 text-xs text-vesale-muted">{label}</p>
        <p className="text-xl font-bold text-vesale-ink">{value}</p>
        <p className="mt-0.5 text-[11px] text-vesale-muted">{sub}</p>
      </div>
    </div>
  );
  return href ? <Link href={href}>{conteudo}</Link> : conteudo;
}

export default async function PainelPage() {
  const session = await auth();
  if (session?.user?.papel !== "GESTOR") {
    redirect("/pdv");
  }

  const resumo = await buscarResumoDashboard();

  return (
    <div className="mx-auto flex max-w-[1500px] flex-col gap-4 p-4 md:p-7">
      <h1 className="text-lg font-semibold text-vesale-ink">Painel</h1>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard
          label="Vendas hoje"
          value={formatBRL(resumo.vendasHojeTotal)}
          sub={`${resumo.vendasHojeQuantidade} venda(s)`}
          accent="bg-vesale-navy"
        />
        <KpiCard
          label="Caixa"
          value={resumo.caixaAberto ? "Aberto" : "Fechado"}
          sub={
            resumo.caixaAberto && resumo.caixaAbertaEm
              ? `Aberto às ${new Date(resumo.caixaAbertaEm).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
              : "Nenhuma sessão ativa"
          }
          accent={resumo.caixaAberto ? "bg-vesale-success" : "bg-vesale-red"}
        />
        <KpiCard
          label="Estoque baixo"
          value={String(resumo.produtosEstoqueBaixo.length)}
          sub="itens abaixo do mínimo"
          accent="bg-vesale-warning"
          href="/estoque"
        />
        <KpiCard
          label="Vencendo (30 dias)"
          value={String(resumo.produtosVencendo.length)}
          sub={`${resumo.produtosVencendo.filter((p) => p.diasRestantes < 0).length} já vencido(s)`}
          accent="bg-vesale-red"
          href="/estoque"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-vesale-border bg-vesale-surface">
          <div className="border-b border-vesale-border px-4 py-2.5 text-sm font-semibold text-vesale-ink">
            Produtos com estoque baixo
          </div>
          <div className="flex flex-col gap-2 p-4">
            {resumo.produtosEstoqueBaixo.length === 0 ? (
              <p className="text-sm text-vesale-muted">Nenhum produto abaixo do estoque mínimo.</p>
            ) : (
              resumo.produtosEstoqueBaixo.map((p) => (
                <div key={p.id} className="flex items-center justify-between rounded-lg bg-vesale-bg px-3 py-2 text-sm">
                  <span className="truncate text-vesale-ink">{p.nome}</span>
                  <span className="font-semibold text-vesale-warning">{p.quantidadeEstoque} un.</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-vesale-border bg-vesale-surface">
          <div className="border-b border-vesale-border px-4 py-2.5 text-sm font-semibold text-vesale-ink">
            Validade próxima ou vencida
          </div>
          <div className="flex flex-col gap-2 p-4">
            {resumo.produtosVencendo.length === 0 ? (
              <p className="text-sm text-vesale-muted">Nenhum lote vencendo nos próximos 30 dias.</p>
            ) : (
              resumo.produtosVencendo.map((p) => (
                <div key={p.id} className="flex items-center justify-between rounded-lg bg-vesale-bg px-3 py-2 text-sm">
                  <span className="truncate text-vesale-ink">{p.nome}</span>
                  <span className={`font-semibold ${p.diasRestantes < 0 ? "text-vesale-red" : "text-vesale-warning"}`}>
                    {p.diasRestantes < 0 ? `Vencido há ${Math.abs(p.diasRestantes)}d` : `${p.diasRestantes}d restantes`}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
