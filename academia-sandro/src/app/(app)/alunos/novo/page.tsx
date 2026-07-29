import Link from "next/link";
import { UserPlus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/PageHeader";
import { SeletorModalidadeHorario } from "@/components/SeletorModalidadeHorario";
import { getHorariosParaSelecao } from "@/lib/agenda";
import { createAluno } from "../actions";

const STATUS_PAGAMENTO = ["Em dia", "Pendente", "Atrasado"];

export default async function NovoAlunoPage({
  searchParams,
}: {
  searchParams: Promise<{ preCadastroId?: string }>;
}) {
  const { preCadastroId } = await searchParams;

  const [preCadastro, horarios] = await Promise.all([
    preCadastroId
      ? prisma.preCadastro.findUnique({ where: { id: preCadastroId } })
      : Promise.resolve(null),
    getHorariosParaSelecao(),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-12">
      <PageHeader
        icon={UserPlus}
        title="Novo Aluno"
        subtitle="Cadastro de um novo aluno"
      />

      {preCadastro && (
        <div className="rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-foreground">
          Completando cadastro a partir do pré-cadastro de{" "}
          <strong>{preCadastro.nome}</strong> — falta só modalidade, faixa e
          status de pagamento.
        </div>
      )}

      <form
        action={createAluno}
        className="flex flex-col gap-4 rounded-lg border border-foreground/10 p-6"
      >
        {preCadastro && (
          <input type="hidden" name="preCadastroId" value={preCadastro.id} />
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            Nome
            <input
              name="nome"
              required
              autoFocus
              defaultValue={preCadastro?.nome}
              className="rounded-md border border-foreground/20 bg-transparent px-3 py-2 outline-none focus:border-primary"
            />
          </label>
          <SeletorModalidadeHorario
            horarios={horarios}
            defaultModalidade={preCadastro?.modalidadeInteresse ?? ""}
          />
          <label className="flex flex-col gap-1 text-sm">
            Faixa / Graduação
            <input
              name="graduacaoFaixa"
              required
              placeholder="Ex: Faixa Azul"
              className="rounded-md border border-foreground/20 bg-transparent px-3 py-2 outline-none focus:border-primary"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Status de Pagamento
            <select
              name="statusPagamento"
              required
              defaultValue=""
              className="rounded-md border border-foreground/20 bg-background px-3 py-2 outline-none focus:border-primary"
            >
              <option value="" disabled>
                Selecione
              </option>
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
              placeholder="Ex: 11987654321"
              defaultValue={preCadastro?.telefone ?? ""}
              className="rounded-md border border-foreground/20 bg-transparent px-3 py-2 outline-none focus:border-primary"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            E-mail
            <input
              name="email"
              type="email"
              defaultValue={preCadastro?.email ?? ""}
              className="rounded-md border border-foreground/20 bg-transparent px-3 py-2 outline-none focus:border-primary"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Data de Nascimento
            <input
              name="dataNascimento"
              type="date"
              defaultValue={
                preCadastro?.dataNascimento
                  ? preCadastro.dataNascimento.toISOString().slice(0, 10)
                  : ""
              }
              className="rounded-md border border-foreground/20 bg-transparent px-3 py-2 outline-none focus:border-primary"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Cidade
            <input
              name="cidade"
              defaultValue={preCadastro?.cidade ?? ""}
              className="rounded-md border border-foreground/20 bg-transparent px-3 py-2 outline-none focus:border-primary"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
            Lesões (opcional)
            <textarea
              name="lesoes"
              rows={2}
              defaultValue={preCadastro?.lesoes ?? ""}
              className="rounded-md border border-foreground/20 bg-transparent px-3 py-2 outline-none focus:border-primary"
            />
          </label>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="aptoExame"
            className="h-4 w-4 accent-primary"
          />
          Apto para exame de graduação
        </label>
        <div className="flex gap-3">
          <button
            type="submit"
            className="inline-flex items-center gap-2 self-start rounded-md bg-primary px-5 py-2 font-medium text-background transition-colors hover:bg-secondary"
          >
            <span aria-hidden="true">🥋</span>
            Cadastrar aluno
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
