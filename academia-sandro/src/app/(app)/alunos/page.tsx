import Link from "next/link";
import { UserPlus, Users } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { diasParaVencer, statusPagamentoEfetivo } from "@/lib/vencimento";
import { mensagemCobranca, montarLinkWhatsapp } from "@/lib/whatsapp";
import { PageHeader } from "@/components/PageHeader";
import { DIA_SEMANA_LABEL, formatarHora } from "@/lib/agenda";
import { deleteAluno } from "./actions";

function statusBadgeClass(status: string) {
  const base = "rounded-full px-2 py-1 text-xs font-medium";
  if (status === "Em dia") return `${base} bg-success/15 text-success`;
  if (status === "Pendente") return `${base} bg-warning/15 text-warning`;
  return `${base} bg-error/15 text-error`;
}

function vencimentoBadge(dataVencimento: Date | null) {
  if (!dataVencimento) return null;
  const dias = diasParaVencer(dataVencimento);
  const base = "rounded-full px-2 py-1 text-xs font-medium whitespace-nowrap";
  const texto = new Intl.DateTimeFormat("pt-BR").format(dataVencimento);

  if (dias < 0) {
    return <span className={`${base} bg-error/15 text-error`}>{texto} (vencida)</span>;
  }
  if (dias <= 3) {
    return <span className={`${base} bg-warning/15 text-warning`}>{texto} ({dias}d)</span>;
  }
  return <span className={`${base} text-foreground/60`}>{texto}</span>;
}

type Filtro = "vencidos" | "aguardando-confirmacao";

const WHERE_VENCIDOS = { dataVencimento: { lt: new Date() } };
const WHERE_AGUARDANDO_CONFIRMACAO = {
  transacoes: {
    some: { comprovanteUrl: { not: null }, confirmadoEm: null },
  },
};

function whereDoFiltro(filtro?: Filtro) {
  if (filtro === "vencidos") return WHERE_VENCIDOS;
  if (filtro === "aguardando-confirmacao") return WHERE_AGUARDANDO_CONFIRMACAO;
  return undefined;
}

function abaClasse(ativa: boolean) {
  const base = "rounded-full px-3 py-1.5 text-sm font-medium transition-colors";
  return ativa
    ? `${base} bg-primary text-background`
    : `${base} border border-foreground/20 text-foreground/70 hover:bg-foreground/5`;
}

export default async function AlunosPage({
  searchParams,
}: {
  searchParams: Promise<{ filtro?: Filtro }>;
}) {
  const { filtro } = await searchParams;

  const [alunos, totalCount, vencidosCount, aguardandoConfirmacaoCount] =
    await Promise.all([
      prisma.aluno.findMany({
        where: whereDoFiltro(filtro),
        orderBy: { dataMatricula: "desc" },
        include: { agendaAulaReferencia: true },
      }),
      prisma.aluno.count(),
      prisma.aluno.count({ where: WHERE_VENCIDOS }),
      prisma.aluno.count({ where: WHERE_AGUARDANDO_CONFIRMACAO }),
    ]);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-12">
      <PageHeader
        icon={Users}
        title="Alunos"
        subtitle="Lista de alunos e controle de vencimento"
        action={
          <Link
            href="/alunos/novo"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-background transition-colors hover:bg-secondary"
          >
            <UserPlus size={16} />
            Novo Aluno
          </Link>
        }
      />

      <div className="flex flex-wrap gap-2">
        <Link href="/alunos" className={abaClasse(!filtro)}>
          Todos ({totalCount})
        </Link>
        <Link
          href="/alunos?filtro=vencidos"
          className={abaClasse(filtro === "vencidos")}
        >
          Pagamento vencido ({vencidosCount})
        </Link>
        <Link
          href="/alunos?filtro=aguardando-confirmacao"
          className={abaClasse(filtro === "aguardando-confirmacao")}
        >
          Aguardando confirmação ({aguardandoConfirmacaoCount})
        </Link>
      </div>

      <div className="overflow-x-auto rounded-lg border border-foreground/10">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-foreground/10 text-foreground/60">
            <tr>
              <th className="px-4 py-3 font-medium">Nome</th>
              <th className="px-4 py-3 font-medium">Modalidade</th>
              <th className="px-4 py-3 font-medium">Horário</th>
              <th className="px-4 py-3 font-medium">Faixa</th>
              <th className="px-4 py-3 font-medium">Pagamento</th>
              <th className="px-4 py-3 font-medium">Vencimento</th>
              <th className="px-4 py-3 font-medium">Apto exame</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {alunos.map((aluno) => (
              <tr
                key={aluno.id}
                className="border-b border-foreground/5 last:border-0"
              >
                <td className="px-4 py-3">{aluno.nome}</td>
                <td className="px-4 py-3">{aluno.modalidade}</td>
                <td className="px-4 py-3 whitespace-nowrap text-foreground/60">
                  {aluno.agendaAulaReferencia
                    ? `${DIA_SEMANA_LABEL[aluno.agendaAulaReferencia.diaSemana]} ${formatarHora(aluno.agendaAulaReferencia.horarioInicio)}`
                    : "—"}
                </td>
                <td className="px-4 py-3">{aluno.graduacaoFaixa}</td>
                <td className="px-4 py-3">
                  <span className={statusBadgeClass(statusPagamentoEfetivo(aluno))}>
                    {statusPagamentoEfetivo(aluno)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {vencimentoBadge(aluno.dataVencimento)}
                </td>
                <td className="px-4 py-3">{aluno.aptoExame ? "Sim" : "Não"}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end items-center gap-3">
                    {aluno.telefone && (
                      <a
                        href={montarLinkWhatsapp(
                          aluno.telefone,
                          mensagemCobranca(
                            aluno.nome,
                            aluno.dataVencimento
                              ? diasParaVencer(aluno.dataVencimento)
                              : 0,
                          ),
                        )}
                        target="_blank"
                        rel="noreferrer"
                        title="Cobrar via WhatsApp"
                        className="text-success hover:underline"
                      >
                        WhatsApp
                      </a>
                    )}
                    <Link
                      href={`/alunos/${aluno.id}/editar`}
                      className="text-primary hover:underline"
                    >
                      Editar
                    </Link>
                    <form action={deleteAluno.bind(null, aluno.id)}>
                      <button type="submit" className="text-error hover:underline">
                        Excluir
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
            {alunos.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-foreground/50">
                  {filtro === "vencidos"
                    ? "Nenhum aluno com pagamento vencido."
                    : filtro === "aguardando-confirmacao"
                      ? "Nenhum aluno aguardando confirmação de pagamento."
                      : "Nenhum aluno cadastrado ainda."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
