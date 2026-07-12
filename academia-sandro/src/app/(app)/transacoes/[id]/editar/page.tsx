import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { updateTransacao } from "../../actions";

function toDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

export default async function EditarTransacaoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [transacao, alunos] = await Promise.all([
    prisma.transacaoFinanceira.findUnique({ where: { id } }),
    prisma.aluno.findMany({
      orderBy: { nome: "asc" },
      select: { id: true, nome: true },
    }),
  ]);

  if (!transacao) {
    notFound();
  }

  const updateTransacaoWithId = updateTransacao.bind(null, transacao.id);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-12">
      <h1 className="text-2xl font-semibold text-foreground">
        Editar Transação
      </h1>

      <form
        action={updateTransacaoWithId}
        className="flex flex-col gap-4 rounded-lg border border-foreground/10 p-6"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            Tipo
            <select
              name="tipo"
              required
              defaultValue={transacao.tipo}
              className="rounded-md border border-foreground/20 bg-background px-3 py-2 outline-none focus:border-primary"
            >
              <option value="Receita">Receita</option>
              <option value="Despesa">Despesa</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Categoria
            <input
              name="categoria"
              required
              defaultValue={transacao.categoria}
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
              defaultValue={transacao.valor.toString()}
              className="rounded-md border border-foreground/20 bg-transparent px-3 py-2 outline-none focus:border-primary"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Data
            <input
              name="dataTransacao"
              type="date"
              required
              defaultValue={toDateInputValue(transacao.dataTransacao)}
              className="rounded-md border border-foreground/20 bg-transparent px-3 py-2 outline-none focus:border-primary"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
            Aluno vinculado (opcional)
            <select
              name="alunoId"
              defaultValue={transacao.alunoId ?? ""}
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
        <div className="flex gap-3">
          <button
            type="submit"
            className="self-start rounded-md bg-primary px-5 py-2 font-medium text-background transition-colors hover:bg-secondary"
          >
            Salvar alterações
          </button>
          <Link
            href="/transacoes"
            className="self-start rounded-md border border-foreground/20 px-5 py-2 font-medium text-foreground transition-colors hover:bg-foreground/5"
          >
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  );
}
