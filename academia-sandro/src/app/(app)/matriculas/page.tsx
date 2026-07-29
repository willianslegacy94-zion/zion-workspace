import Link from "next/link";
import { ClipboardCheck } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { DIA_SEMANA_LABEL, formatarHora } from "@/lib/agenda-constants";
import { PageHeader } from "@/components/PageHeader";
import { limparComprovantesExpirados } from "@/lib/comprovantes";
import { confirmarPagamento } from "../transacoes/actions";

const moeda = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export default async function MatriculasPage() {
  await limparComprovantesExpirados();

  const matriculas = await prisma.matricula.findMany({
    where: { transacao: { confirmadoEm: null } },
    orderBy: { criadoEm: "desc" },
    include: {
      aluno: { select: { nome: true } },
      agendaAula: { select: { modalidade: true, diaSemana: true, horarioInicio: true } },
      transacao: {
        select: {
          id: true,
          valor: true,
          formaPagamento: true,
          comprovanteUrl: true,
          confirmadoEm: true,
        },
      },
    },
  });

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-12">
      <PageHeader
        icon={ClipboardCheck}
        title="Novas Matrículas"
        subtitle="Matrículas em modalidades extras feitas pelos próprios alunos"
      />

      <div className="overflow-x-auto rounded-lg border border-surface-border">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-surface-border text-foreground/60">
            <tr>
              <th className="px-4 py-3 font-medium">Aluno</th>
              <th className="px-4 py-3 font-medium">Horário</th>
              <th className="px-4 py-3 font-medium">Forma de pagamento</th>
              <th className="px-4 py-3 font-medium">Valor</th>
              <th className="px-4 py-3 font-medium">Comprovante</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {matriculas.map((m) => (
              <tr
                key={m.id}
                className="border-b border-surface-border last:border-0"
              >
                <td className="px-4 py-3">{m.aluno.nome}</td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {m.agendaAula.modalidade} —{" "}
                  {DIA_SEMANA_LABEL[m.agendaAula.diaSemana]}{" "}
                  {formatarHora(m.agendaAula.horarioInicio)}
                </td>
                <td className="px-4 py-3">
                  {m.transacao?.formaPagamento ?? "—"}
                </td>
                <td className="px-4 py-3">
                  {m.transacao ? moeda.format(Number(m.transacao.valor)) : "—"}
                </td>
                <td className="px-4 py-3">
                  {!m.transacao?.comprovanteUrl ? (
                    <span className="rounded-full bg-warning/15 px-2 py-1 text-xs font-medium text-warning">
                      Aguardando comprovante
                    </span>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      <a
                        href={m.transacao.comprovanteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-full bg-primary/15 px-2 py-1 text-xs font-medium text-primary hover:underline"
                      >
                        Ver comprovante
                      </a>
                      <form action={confirmarPagamento.bind(null, m.transacao.id)}>
                        <button
                          type="submit"
                          className="rounded-full bg-success/15 px-2 py-1 text-xs font-medium text-success transition-colors hover:bg-success/25"
                        >
                          Confirmar pagamento
                        </button>
                      </form>
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  {m.transacao && (
                    <Link
                      href={`/transacoes/${m.transacao.id}/editar`}
                      className="text-primary hover:underline"
                    >
                      Editar cobrança
                    </Link>
                  )}
                </td>
              </tr>
            ))}
            {matriculas.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-6 text-center text-foreground/50"
                >
                  Nenhuma matrícula pendente de confirmação.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
