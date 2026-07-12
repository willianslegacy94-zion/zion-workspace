import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { updateDespesa } from "../../actions";

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

export default async function EditarDespesaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const despesa = await prisma.despesa.findUnique({ where: { id } });

  if (!despesa) {
    notFound();
  }

  const updateDespesaWithId = updateDespesa.bind(null, despesa.id);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-12">
      <h1 className="text-2xl font-semibold text-foreground">
        Editar Despesa
      </h1>

      <form
        action={updateDespesaWithId}
        className="card-premium flex flex-col gap-4 p-6"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            Categoria
            <select
              name="categoria"
              required
              defaultValue={despesa.categoria}
              className="input-dark"
            >
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
              defaultValue={despesa.descricao}
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
              defaultValue={despesa.valor.toString()}
              className="input-dark"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Data
            <input
              name="data"
              type="date"
              required
              defaultValue={despesa.data.toISOString().slice(0, 10)}
              className="input-dark"
            />
          </label>
        </div>

        {despesa.recorrente && (
          <p className="text-xs text-foreground/50">
            Essa despesa faz parte de uma recorrência ({despesa.frequenciaRecorrencia}).
            Editar aqui altera só esta ocorrência.
          </p>
        )}

        <div className="flex gap-3">
          <button type="submit" className="btn-gold">
            Salvar alterações
          </button>
          <Link href="/despesas" className="btn-outline-gold">
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  );
}
