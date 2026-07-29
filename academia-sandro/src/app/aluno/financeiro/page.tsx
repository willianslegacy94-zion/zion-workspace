import { redirect } from "next/navigation";
import { Upload, Wallet } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { diasParaVencer, statusPagamentoEfetivo } from "@/lib/vencimento";
import { getParcelas } from "@/lib/parcelas";
import { PageHeader } from "@/components/PageHeader";
import { anexarComprovante } from "../actions";

const moeda = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const mesFormatter = new Intl.DateTimeFormat("pt-BR", {
  month: "long",
  year: "numeric",
});

function statusBadgeClass(status: string) {
  const base = "rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap";
  if (status === "Em dia" || status === "Paga") return `${base} bg-success/15 text-success`;
  if (status === "Pendente" || status === "Aguardando confirmação")
    return `${base} bg-warning/15 text-warning`;
  if (status === "A vencer") return `${base} bg-foreground/10 text-foreground/60`;
  return `${base} bg-error/15 text-error`;
}

function capitalizar(texto: string) {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export default async function AlunoFinanceiroPage() {
  const session = await auth();
  const alunoId = session?.user?.alunoId;

  if (!alunoId) {
    redirect("/login");
  }

  const aluno = await prisma.aluno.findUnique({
    where: { id: alunoId },
    include: {
      transacoes: {
        where: { matriculaId: { not: null } },
        orderBy: { dataTransacao: "desc" },
      },
    },
  });
  if (!aluno) {
    redirect("/login");
  }

  const parcelas = await getParcelas(alunoId);
  const chavePix = process.env.PIX_KEY_CT?.trim();

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        icon={Wallet}
        title="Financeiro"
        subtitle="Mensalidade, vencimento e comprovantes de pagamento"
      />

      <div className="card-premium flex flex-col gap-5 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-surface-hover px-4 py-3">
          <span className="text-sm text-foreground/60">Mensalidade</span>
          <span className={statusBadgeClass(statusPagamentoEfetivo(aluno))}>
            {statusPagamentoEfetivo(aluno)}
          </span>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-surface-hover px-4 py-3">
          <span className="text-sm text-foreground/60">Vencimento</span>
          <span className="text-sm font-medium text-foreground">
            {aluno.dataVencimento
              ? `${new Intl.DateTimeFormat("pt-BR").format(aluno.dataVencimento)} (${diasParaVencer(aluno.dataVencimento)}d)`
              : "Não definido"}
          </span>
        </div>

        <div className="rounded-lg bg-surface-hover px-4 py-3">
          <span className="text-sm text-foreground/60">Chave PIX do CT</span>
          <p className="mt-1 break-all font-mono text-sm text-primary">
            {chavePix || "Chave ainda não configurada — fale com a recepção."}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-foreground">
          Parcelas (12 meses a partir da matrícula)
        </h2>

        <div className="overflow-x-auto rounded-lg border border-surface-border">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-surface-border text-foreground/60">
              <tr>
                <th className="px-4 py-3 font-medium">Mês</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Valor</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {parcelas.map((parcela) => (
                <tr
                  key={parcela.mes.toISOString()}
                  className="border-b border-surface-border last:border-0"
                >
                  <td className="px-4 py-3 whitespace-nowrap">
                    {capitalizar(mesFormatter.format(parcela.mes))}
                  </td>
                  <td className="px-4 py-3">
                    <span className={statusBadgeClass(parcela.status)}>
                      {parcela.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {parcela.valor !== null ? moeda.format(parcela.valor) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {parcela.transacaoId && !parcela.comprovanteUrl && (
                      <form
                        action={anexarComprovante.bind(null, parcela.transacaoId)}
                        className="flex flex-col gap-2 sm:flex-row sm:items-center"
                      >
                        <input
                          type="file"
                          name="comprovante"
                          required
                          accept="image/*,application/pdf"
                          className="text-xs file:mr-2 file:rounded-md file:border-0 file:bg-primary/15 file:px-2 file:py-1 file:text-xs file:font-medium file:text-primary"
                        />
                        <button
                          type="submit"
                          className="inline-flex shrink-0 items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-background transition-colors hover:bg-secondary"
                        >
                          <Upload size={12} />
                          Anexar
                        </button>
                      </form>
                    )}
                    {parcela.comprovanteUrl && (
                      <a
                        href={parcela.comprovanteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline"
                      >
                        Ver comprovante
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {aluno.transacoes.length > 0 && (
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-foreground">
            Outras cobranças (modalidades extras)
          </h2>

          {aluno.transacoes.map((transacao) => (
            <div
              key={transacao.id}
              className="card-premium flex flex-col gap-3 p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-foreground">
                    {transacao.categoria}
                  </p>
                  <p className="text-xs text-foreground/50">
                    {new Intl.DateTimeFormat("pt-BR").format(
                      transacao.dataTransacao,
                    )}
                    {transacao.dataVencimento &&
                      ` · vencimento ${new Intl.DateTimeFormat("pt-BR").format(transacao.dataVencimento)}`}
                    {transacao.formaPagamento &&
                      ` · ${transacao.formaPagamento}`}
                  </p>
                </div>
                <span className="font-serif text-lg font-bold text-primary">
                  {moeda.format(Number(transacao.valor))}
                </span>
              </div>

              {transacao.comprovanteUrl ? (
                <p className="text-xs text-success">
                  Comprovante enviado —{" "}
                  <a
                    href={transacao.comprovanteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    visualizar
                  </a>
                </p>
              ) : (
                <form
                  action={anexarComprovante.bind(null, transacao.id)}
                  className="flex flex-col gap-2 sm:flex-row sm:items-center"
                >
                  <input
                    type="file"
                    name="comprovante"
                    required
                    accept="image/*,application/pdf"
                    className="input-dark w-full text-xs file:mr-3 file:rounded-md file:border-0 file:bg-primary/15 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-primary"
                  />
                  <button
                    type="submit"
                    className="btn-gold w-full shrink-0 sm:w-auto"
                  >
                    <Upload size={14} />
                    Anexar Comprovante
                  </button>
                </form>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
