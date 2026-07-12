import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { updateAluno } from "../../actions";

const MODALIDADES = ["Jiu-Jitsu", "Muay Thai", "Judô", "Boxe", "Outra"];
const STATUS_PAGAMENTO = ["Em dia", "Pendente", "Atrasado"];

export default async function EditarAlunoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const aluno = await prisma.aluno.findUnique({ where: { id } });

  if (!aluno) {
    notFound();
  }

  const updateAlunoWithId = updateAluno.bind(null, aluno.id);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-12">
      <h1 className="text-2xl font-semibold text-foreground">Editar Aluno</h1>

      <form
        action={updateAlunoWithId}
        className="flex flex-col gap-4 rounded-lg border border-foreground/10 p-6"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            Nome
            <input
              name="nome"
              required
              defaultValue={aluno.nome}
              className="rounded-md border border-foreground/20 bg-transparent px-3 py-2 outline-none focus:border-primary"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Modalidade
            <select
              name="modalidade"
              required
              defaultValue={aluno.modalidade}
              className="rounded-md border border-foreground/20 bg-background px-3 py-2 outline-none focus:border-primary"
            >
              {MODALIDADES.map((modalidade) => (
                <option key={modalidade} value={modalidade}>
                  {modalidade}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Faixa / Graduação
            <input
              name="graduacaoFaixa"
              required
              defaultValue={aluno.graduacaoFaixa}
              placeholder="Ex: Faixa Azul"
              className="rounded-md border border-foreground/20 bg-transparent px-3 py-2 outline-none focus:border-primary"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Status de Pagamento
            <select
              name="statusPagamento"
              required
              defaultValue={aluno.statusPagamento}
              className="rounded-md border border-foreground/20 bg-background px-3 py-2 outline-none focus:border-primary"
            >
              {STATUS_PAGAMENTO.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Telefone (WhatsApp)
            <input
              name="telefone"
              defaultValue={aluno.telefone ?? ""}
              placeholder="Ex: 11987654321"
              className="rounded-md border border-foreground/20 bg-transparent px-3 py-2 outline-none focus:border-primary"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            E-mail
            <input
              name="email"
              type="email"
              defaultValue={aluno.email ?? ""}
              className="rounded-md border border-foreground/20 bg-transparent px-3 py-2 outline-none focus:border-primary"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Data de Nascimento
            <input
              name="dataNascimento"
              type="date"
              defaultValue={
                aluno.dataNascimento
                  ? aluno.dataNascimento.toISOString().slice(0, 10)
                  : ""
              }
              className="rounded-md border border-foreground/20 bg-transparent px-3 py-2 outline-none focus:border-primary"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Cidade
            <input
              name="cidade"
              defaultValue={aluno.cidade ?? ""}
              className="rounded-md border border-foreground/20 bg-transparent px-3 py-2 outline-none focus:border-primary"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
            Lesões (opcional)
            <textarea
              name="lesoes"
              rows={2}
              defaultValue={aluno.lesoes ?? ""}
              className="rounded-md border border-foreground/20 bg-transparent px-3 py-2 outline-none focus:border-primary"
            />
          </label>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="aptoExame"
            defaultChecked={aluno.aptoExame}
            className="h-4 w-4 accent-primary"
          />
          Apto para exame de graduação
        </label>
        <div className="flex gap-3">
          <button
            type="submit"
            className="self-start rounded-md bg-primary px-5 py-2 font-medium text-background transition-colors hover:bg-secondary"
          >
            Salvar alterações
          </button>
          <Link
            href="/alunos"
            className="self-start rounded-md border border-foreground/20 px-5 py-2 font-medium text-foreground transition-colors hover:bg-foreground/5"
          >
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  );
}
