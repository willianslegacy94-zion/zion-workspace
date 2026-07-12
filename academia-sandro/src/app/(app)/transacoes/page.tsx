import Link from "next/link";
import { Wallet } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/PageHeader";
import { createTransacao, deleteTransacao } from "./actions";

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export default async function TransacoesPage() {
  const [transacoes, alunos] = await Promise.all([
    prisma.transacaoFinanceira.findMany({
      orderBy: { dataTransacao: "desc" },
      include: { aluno: true },
    }),
    prisma.aluno.findMany({
      orderBy: { nome: "asc" },
      select: { id: true, nome: true },
    }),
  ]);

  const saldo = transacoes.reduce((total, t) => {
    const valor = Number(t.valor);
    return t.tipo === "Receita" ? total + valor : total - valor;
  }, 0);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-12">
      <PageHeader
        icon={Wallet}
        title="Transações Financeiras"
        subtitle="Receitas e despesas vinculadas aos alunos"
        action={
          <span
            className={`text-lg font-semibold ${saldo >= 0 ? "text-success" : "text-error"}`}
          >
            Saldo: {currency.format(saldo)}
          </span>
        }
      />

      <form
        action={createTransacao}
        className="flex flex-col gap-4 rounded-lg border border-foreground/10 p-6"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            Tipo
            <select
              name="tipo"
              required
              defaultValue=""
              className="rounded-md border border-foreground/20 bg-background px-3 py-2 outline-none focus:border-primary"
            >
              <option value="" disabled>
                Selecione
              </option>
              <option value="Receita">Receita</option>
              <option value="Despesa">Despesa</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Categoria
            <input
              name="categoria"
              required
              placeholder="Ex: Mensalidade"
              className="rounded-md border border-foreground/20 bg-transparent px-3 py-2 outline-none focus:border-primary"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Valor (R$)
            <input
              name="valor"
              type="number"
              step="0.01"
              min="0"
              required
              className="rounded-md border border-foreground/20 bg-transparent px-3 py-2 outline-none focus:border-primary"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Data
            <input
              name="dataTransacao"
              type="date"
              required
              className="rounded-md border border-foreground/20 bg-transparent px-3 py-2 outline-none focus:border-primary"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
            Aluno vinculado (opcional)
            <select
              name="alunoId"
              defaultValue=""
              className="rounded-md border border-foreground/20 bg-background px-3 py-2 outline-none focus:border-primary"
            >
              <option value="">Nenhum</option>
              {alunos.map((aluno) => (
                <option key={aluno.id} value={aluno.id}>
                  {aluno.nome}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button
          type="submit"
          className="self-start rounded-md bg-primary px-5 py-2 font-medium text-background transition-colors hover:bg-secondary"
        >
          Registrar transação
        </button>
      </form>

      <div className="overflow-x-auto rounded-lg border border-foreground/10">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-foreground/10 text-foreground/60">
            <tr>
              <th className="px-4 py-3 font-medium">Data</th>
              <th className="px-4 py-3 font-medium">Tipo</th>
              <th className="px-4 py-3 font-medium">Categoria</th>
              <th className="px-4 py-3 font-medium">Aluno</th>
              <th className="px-4 py-3 font-medium">Valor</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {transacoes.map((t) => (
              <tr
                key={t.id}
                className="border-b border-foreground/5 last:border-0"
              >
                <td className="px-4 py-3">
                  {new Intl.DateTimeFormat("pt-BR").format(t.dataTransacao)}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={t.tipo === "Receita" ? "text-success" : "text-error"}
                  >
                    {t.tipo}
                  </span>
                </td>
                <td className="px-4 py-3">{t.categoria}</td>
                <td className="px-4 py-3">{t.aluno?.nome ?? "—"}</td>
                <td className="px-4 py-3">{currency.format(Number(t.valor))}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-3">
                    <Link
                      href={`/transacoes/${t.id}/editar`}
                      className="text-primary hover:underline"
                    >
                      Editar
                    </Link>
                    <form action={deleteTransacao.bind(null, t.id)}>
                      <button type="submit" className="text-error hover:underline">
                        Excluir
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
            {transacoes.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-foreground/50">
                  Nenhuma transação registrada ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
