import Link from "next/link";
import { Users } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { diasParaVencer } from "@/lib/vencimento";
import { mensagemCobranca, montarLinkWhatsapp } from "@/lib/whatsapp";
import { PageHeader } from "@/components/PageHeader";
import { createAluno, deleteAluno } from "./actions";

const MODALIDADES = ["Jiu-Jitsu", "Muay Thai", "Judô", "Boxe", "Outra"];
const STATUS_PAGAMENTO = ["Em dia", "Pendente", "Atrasado"];

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

export default async function AlunosPage({
  searchParams,
}: {
  searchParams: Promise<{ preCadastroId?: string }>;
}) {
  const { preCadastroId } = await searchParams;

  const [alunos, preCadastro] = await Promise.all([
    prisma.aluno.findMany({
      orderBy: { dataMatricula: "desc" },
    }),
    preCadastroId
      ? prisma.preCadastro.findUnique({ where: { id: preCadastroId } })
      : Promise.resolve(null),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-12">
      <PageHeader
        icon={Users}
        title="Alunos"
        subtitle="Cadastro, matrículas e controle de vencimento"
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
              defaultValue={preCadastro?.nome}
              className="rounded-md border border-foreground/20 bg-transparent px-3 py-2 outline-none focus:border-primary"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Modalidade
            <select
              name="modalidade"
              required
              defaultValue=""
              className="rounded-md border border-foreground/20 bg-background px-3 py-2 outline-none focus:border-primary"
            >
              <option value="" disabled>
                Selecione
              </option>
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
        <button
          type="submit"
          className="inline-flex items-center gap-2 self-start rounded-md bg-primary px-5 py-2 font-medium text-background transition-colors hover:bg-secondary"
        >
          <span aria-hidden="true">🥋</span>
          Cadastrar aluno
        </button>
      </form>

      <div className="overflow-x-auto rounded-lg border border-foreground/10">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-foreground/10 text-foreground/60">
            <tr>
              <th className="px-4 py-3 font-medium">Nome</th>
              <th className="px-4 py-3 font-medium">Modalidade</th>
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
                <td className="px-4 py-3">{aluno.graduacaoFaixa}</td>
                <td className="px-4 py-3">
                  <span className={statusBadgeClass(aluno.statusPagamento)}>
                    {aluno.statusPagamento}
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
                <td colSpan={7} className="px-4 py-6 text-center text-foreground/50">
                  Nenhum aluno cadastrado ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
