import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { montarLinkWhatsapp, mensagemAcessoPortal } from "@/lib/whatsapp";
import { getHorariosParaSelecao } from "@/lib/agenda";
import { SeletorModalidadeHorario } from "@/components/SeletorModalidadeHorario";
import {
  updateAluno,
  criarAcessoAluno,
  reenviarAcessoAluno,
  revogarAcessoAluno,
} from "../../actions";

const STATUS_PAGAMENTO = ["Em dia", "Pendente", "Atrasado"];

export default async function EditarAlunoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ acessoLink?: string }>;
}) {
  const { id } = await params;
  const { acessoLink } = await searchParams;
  const [aluno, horarios] = await Promise.all([
    prisma.aluno.findUnique({
      where: { id },
      include: { usuario: true },
    }),
    getHorariosParaSelecao(),
  ]);

  if (!aluno) {
    notFound();
  }

  const updateAlunoWithId = updateAluno.bind(null, aluno.id);
  const criarAcessoComId = criarAcessoAluno.bind(null, aluno.id);
  const reenviarAcessoComId = reenviarAcessoAluno.bind(null, aluno.id);
  const revogarAcessoComId = revogarAcessoAluno.bind(null, aluno.id);

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
          <SeletorModalidadeHorario
            horarios={horarios}
            defaultModalidade={aluno.modalidade}
            defaultAgendaAulaId={aluno.agendaAulaReferenciaId ?? ""}
          />
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

      <div className="flex flex-col gap-4 rounded-lg border border-foreground/10 p-6">
        <h2 className="text-lg font-semibold text-foreground">
          Acesso ao Portal do Aluno
        </h2>

        {aluno.usuario ? (
          <>
            <p className="text-sm text-foreground/70">
              Acesso ativo — usuário{" "}
              <strong className="text-foreground">
                {aluno.usuario.username}
              </strong>{" "}
              ({aluno.usuario.email})
            </p>
            <div className="flex flex-wrap gap-3">
              <form action={reenviarAcessoComId}>
                <button
                  type="submit"
                  className="rounded-md border border-foreground/20 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-foreground/5"
                >
                  Gerar novo link de acesso
                </button>
              </form>
              <form action={revogarAcessoComId}>
                <button
                  type="submit"
                  className="rounded-md border border-error/30 px-4 py-2 text-sm font-medium text-error transition-colors hover:bg-error/10"
                >
                  Revogar acesso
                </button>
              </form>
            </div>
          </>
        ) : (
          <form
            action={criarAcessoComId}
            className="flex flex-col gap-4 sm:flex-row sm:items-end"
          >
            <label className="flex flex-1 flex-col gap-1 text-sm">
              Usuário
              <input
                name="username"
                required
                placeholder="Ex: joao.silva"
                className="rounded-md border border-foreground/20 bg-transparent px-3 py-2 outline-none focus:border-primary"
              />
            </label>
            <label className="flex flex-1 flex-col gap-1 text-sm">
              E-mail
              <input
                name="email"
                type="email"
                required
                defaultValue={aluno.email ?? ""}
                className="rounded-md border border-foreground/20 bg-transparent px-3 py-2 outline-none focus:border-primary"
              />
            </label>
            <button
              type="submit"
              className="rounded-md bg-primary px-5 py-2 font-medium text-background transition-colors hover:bg-secondary"
            >
              Criar acesso
            </button>
          </form>
        )}

        {acessoLink && (
          <div className="flex flex-col gap-2 rounded-lg border border-warning/30 bg-warning/10 p-4 text-sm animate-fade-in">
            <p className="font-medium text-foreground">
              Link gerado — envie para o aluno definir a senha:
            </p>
            <p className="break-all text-primary">{acessoLink}</p>
            <div className="flex flex-wrap gap-4">
              {aluno.telefone && (
                <a
                  href={montarLinkWhatsapp(
                    aluno.telefone,
                    mensagemAcessoPortal(aluno.nome, acessoLink),
                  )}
                  target="_blank"
                  rel="noreferrer"
                  className="self-start font-medium text-success hover:underline"
                >
                  Enviar por WhatsApp
                </a>
              )}
              {aluno.email && (
                <a
                  href={`mailto:${aluno.email}?subject=${encodeURIComponent(
                    "Seu acesso ao portal do Centro de Treinamento Sandro Ferreira",
                  )}&body=${encodeURIComponent(
                    mensagemAcessoPortal(aluno.nome, acessoLink),
                  )}`}
                  className="self-start font-medium text-primary hover:underline"
                >
                  Enviar por E-mail
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
