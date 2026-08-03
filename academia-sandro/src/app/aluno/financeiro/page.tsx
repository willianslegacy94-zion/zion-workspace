import { redirect } from "next/navigation";
import { Upload, Wallet } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { diasParaVencer, statusPagamentoEfetivo } from "@/lib/vencimento";
import { getParcelasCiclo, type Parcela } from "@/lib/parcelas";
import { getPrecosModalidade, valorEfetivoAluno, type TipoPacote } from "@/lib/precos";
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

// Reutilizado tanto pela mensalidade principal quanto por cada modalidade
// extra — cada uma tem seu próprio ciclo de 12 parcelas (ver
// getParcelasCiclo em src/lib/parcelas.ts).
function TabelaParcelas({ parcelas }: { parcelas: Parcela[] }) {
  return (
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
                <span className={statusBadgeClass(parcela.status)}>{parcela.status}</span>
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
  );
}

type ModalidadeExtraFinanceiro = {
  matriculaId: string;
  modalidade: string;
  dataVencimentoBase: Date;
  parcelas: Parcela[];
};

type PerfilFinanceiro = {
  id: string;
  nome: string;
  modalidadePrincipal: string;
  dataVencimento: Date | null;
  statusPagamento: string;
  valorTotal: number;
  parcelasPrincipal: Parcela[];
  modalidadesExtras: ModalidadeExtraFinanceiro[];
};

export default async function AlunoFinanceiroPage() {
  const session = await auth();
  const alunoId = session?.user?.alunoId;

  if (!alunoId) {
    redirect("/login");
  }

  const aluno = await prisma.aluno.findUnique({
    where: { id: alunoId },
    include: {
      pacoteMembro: {
        include: {
          pacote: { include: { membros: { include: { aluno: true } } } },
        },
      },
    },
  });
  if (!aluno) {
    redirect("/login");
  }

  const ehTitularDeFamilia =
    aluno.pacoteMembro?.pacote.tipo === "FAMILIA" && aluno.pacoteMembro.titular;

  const alunosParaExibir = ehTitularDeFamilia
    ? aluno.pacoteMembro!.pacote.membros.map((m) => m.aluno)
    : [aluno];

  const [precosModalidade, admin] = await Promise.all([
    getPrecosModalidade(),
    prisma.usuario.findUnique({
      where: { username: process.env.ADMIN_USERNAME },
      select: { pix: true },
    }),
  ]);
  const chavePix = admin?.pix?.trim();

  const perfis: PerfilFinanceiro[] = await Promise.all(
    alunosParaExibir.map(async (perfilAluno) => {
      const [parcelasPrincipal, matriculas, membro] = await Promise.all([
        getParcelasCiclo({
          alunoId: perfilAluno.id,
          matriculaId: null,
          dataBase: perfilAluno.dataMatricula,
        }),
        prisma.matricula.findMany({
          where: { alunoId: perfilAluno.id },
          include: { agendaAula: { select: { modalidade: true } } },
          orderBy: { criadoEm: "asc" },
        }),
        prisma.pacoteMembro.findUnique({
          where: { alunoId: perfilAluno.id },
          include: { pacote: true },
        }),
      ]);

      const modalidadesExtras: ModalidadeExtraFinanceiro[] = await Promise.all(
        matriculas.map(async (matricula) => ({
          matriculaId: matricula.id,
          modalidade: matricula.agendaAula.modalidade,
          dataVencimentoBase: matricula.dataVencimentoBase,
          parcelas: await getParcelasCiclo({
            alunoId: perfilAluno.id,
            matriculaId: matricula.id,
            dataBase: matricula.dataVencimentoBase,
          }),
        })),
      );

      const efetivo = await valorEfetivoAluno(
        {
          id: perfilAluno.id,
          modalidade: perfilAluno.modalidade,
          mensalidadeValor:
            perfilAluno.mensalidadeValor !== null
              ? Number(perfilAluno.mensalidadeValor)
              : null,
        },
        precosModalidade,
        membro
          ? {
              descontoPercentual: Number(membro.descontoPercentual),
              pacote: { nome: membro.pacote.nome, tipo: membro.pacote.tipo as TipoPacote },
            }
          : null,
      );

      return {
        id: perfilAluno.id,
        nome: perfilAluno.nome,
        modalidadePrincipal: perfilAluno.modalidade,
        dataVencimento: perfilAluno.dataVencimento,
        statusPagamento: perfilAluno.statusPagamento,
        valorTotal: efetivo.total,
        parcelasPrincipal,
        modalidadesExtras,
      };
    }),
  );

  return (
    <div className="flex flex-col gap-10">
      <PageHeader
        icon={Wallet}
        title="Financeiro"
        subtitle={
          ehTitularDeFamilia
            ? "Mensalidade, vencimento e comprovantes de pagamento — sua família"
            : "Mensalidade, vencimento e comprovantes de pagamento"
        }
      />

      {perfis.map((perfil) => (
        <div key={perfil.id} className="flex flex-col gap-6">
          {perfis.length > 1 && (
            <h2 className="text-lg font-semibold text-foreground">
              {perfil.id === alunoId ? "Sua mensalidade" : `Mensalidade de ${perfil.nome}`}
            </h2>
          )}

          <div className="card-premium flex flex-col gap-5 p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-surface-hover px-4 py-3">
              <span className="text-sm text-foreground/60">Status</span>
              <span className={statusBadgeClass(statusPagamentoEfetivo(perfil))}>
                {statusPagamentoEfetivo(perfil)}
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-surface-hover px-4 py-3">
              <span className="text-sm text-foreground/60">
                Valor total (mensalidade + modalidades extras)
              </span>
              <span className="text-sm font-medium text-primary">
                {moeda.format(perfil.valorTotal)}
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-surface-hover px-4 py-3">
              <span className="text-sm text-foreground/60">Vencimento da mensalidade</span>
              <span className="text-sm font-medium text-foreground">
                {perfil.dataVencimento
                  ? `${new Intl.DateTimeFormat("pt-BR").format(perfil.dataVencimento)} (${diasParaVencer(perfil.dataVencimento)}d)`
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
            <h3 className="text-base font-semibold text-foreground">
              {perfil.modalidadePrincipal} — parcelas (12 meses a partir da matrícula)
            </h3>
            <TabelaParcelas parcelas={perfil.parcelasPrincipal} />
          </div>

          {perfil.modalidadesExtras.map((extra) => (
            <div key={extra.matriculaId} className="flex flex-col gap-4">
              <h3 className="text-base font-semibold text-foreground">
                {extra.modalidade} — parcelas (12 meses a partir de{" "}
                {new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(
                  extra.dataVencimentoBase,
                )})
              </h3>
              <TabelaParcelas parcelas={extra.parcelas} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
