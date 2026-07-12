import Link from "next/link";
import { Receipt } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/PageHeader";
import { createDespesa, deleteDespesa } from "./actions";

const CATEGORIAS = [
  "Aluguel",
  "Salário",
  "Equipamento",
  "Marketing",
  "Manutenção",
  "Utilidades",
  "Impostos",
  "Outros",
];

const FREQUENCIAS = ["Semanal", "Mensal", "Anual"];

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export default async function DespesasPage() {
  const despesas = await prisma.despesa.findMany({
    orderBy: { data: "desc" },
  });

  const totalMesAtual = despesas
    .filter((d) => {
      const hoje = new Date();
      return (
        d.data.getMonth() === hoje.getMonth() &&
        d.data.getFullYear() === hoje.getFullYear()
      );
    })
    .reduce((total, d) => total + Number(d.valor), 0);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-12">
      <PageHeader
        icon={Receipt}
        title="Despesas"
        subtitle="Custos operacionais, com suporte a recorrência"
        action={
          <span className="text-lg font-semibold text-error">
            Este mês: {currency.format(totalMesAtual)}
          </span>
        }
      />

      <form
        action={createDespesa}
        className="card-premium flex flex-col gap-4 p-6"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            Categoria
            <select
              name="categoria"
              required
              defaultValue=""
              className="input-dark"
            >
              <option value="" disabled>
                Selecione
              </option>
              {CATEGORIAS.map((categoria) => (
                <option key={categoria} value={categoria}>
                  {categoria}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Descrição
            <input
              name="descricao"
              required
              placeholder="Ex: Aluguel do salão"
              className="input-dark"
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
              className="input-dark"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Data
            <input name="data" type="date" required className="input-dark" />
          </label>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="recorrente"
            id="recorrente"
            className="h-4 w-4 accent-primary"
          />
          Despesa recorrente (gera as próximas 11 ocorrências automaticamente)
        </label>

        <label className="flex flex-col gap-1 text-sm sm:max-w-xs">
          Frequência
          <select name="frequenciaRecorrencia" defaultValue="Mensal" className="input-dark">
            {FREQUENCIAS.map((freq) => (
              <option key={freq} value={freq}>
                {freq}
              </option>
            ))}
          </select>
        </label>

        <button type="submit" className="btn-gold self-start">
          Registrar despesa
        </button>
      </form>

      <div className="overflow-x-auto rounded-lg border border-surface-border">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-surface-border text-foreground/60">
            <tr>
              <th className="px-4 py-3 font-medium">Data</th>
              <th className="px-4 py-3 font-medium">Categoria</th>
              <th className="px-4 py-3 font-medium">Descrição</th>
              <th className="px-4 py-3 font-medium">Valor</th>
              <th className="px-4 py-3 font-medium">Recorrente</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {despesas.map((despesa) => (
              <tr
                key={despesa.id}
                className="border-b border-surface-border last:border-0"
              >
                <td className="px-4 py-3">
                  {new Intl.DateTimeFormat("pt-BR").format(despesa.data)}
                </td>
                <td className="px-4 py-3">{despesa.categoria}</td>
                <td className="px-4 py-3">{despesa.descricao}</td>
                <td className="px-4 py-3">
                  {currency.format(Number(despesa.valor))}
                </td>
                <td className="px-4 py-3">
                  {despesa.recorrente
                    ? despesa.frequenciaRecorrencia
                    : "Não"}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-3">
                    <Link
                      href={`/despesas/${despesa.id}/editar`}
                      className="text-primary hover:underline"
                    >
                      Editar
                    </Link>
                    <form action={deleteDespesa.bind(null, despesa.id)}>
                      <button
                        type="submit"
                        className="text-error hover:underline"
                      >
                        Excluir
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
            {despesas.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-6 text-center text-foreground/50"
                >
                  Nenhuma despesa registrada ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
