import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { montarLinkWhatsapp, mensagemAcessoPortal } from "@/lib/whatsapp";
import { getHorariosParaSelecao } from "@/lib/agenda";
import { getPacotes } from "@/lib/precos";
import { SeletorModalidadeHorario } from "@/components/SeletorModalidadeHorario";
import { DIA_SEMANA_LABEL, formatarHora } from "@/lib/agenda-constants";
import {
  updateAluno,
  criarAcessoAluno,
  reenviarAcessoAluno,
  revogarAcessoAluno,
  atualizarVencimentoMatricula,
} from "../../actions";

const STATUS_PAGAMENTO = ["Em dia", "Pendente", "Atrasado"];

function labelPacote(tipo: string) {
  return tipo === "FAMILIA" ? "Família" : "Combo modalidades";
}

export default async function EditarAlunoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ acessoLink?: string }>;
}) {
  const { id } = await params;
  const { acessoLink } = await searchParams;
  const [aluno, horarios, pacotes] = await Promise.all([
    prisma.aluno.findUnique({
      where: { id },
      include: {
        usuario: true,
        pacoteMembro: {
          include: {
            pacote: { include: { membros: { include: { aluno: true } } } },
          },
        },
        matriculas: {
          include: { agendaAula: { select: { modalidade: true, diaSemana: true, horarioInicio: true } } },
          orderBy: { criadoEm: "asc" },
        },
      },
    }),
    getHorariosParaSelecao(),
    getPacotes(),
  ]);

  if (!aluno) {
    notFound();
  }

  const updateAlunoWithId = updateAluno.bind(null, aluno.id);
  const criarAcessoComId = criarAcessoAluno.bind(null, aluno.id);
  const reenviarAcessoComId = reenviarAcessoAluno.bind(null, aluno.id);
  const revogarAcessoComId = revogarAcessoAluno.bind(null, aluno.id);

  const pacoteMembro = aluno.pacoteMembro;
  const membroNaoTitularDeFamilia =
    pacoteMembro?.pacote.tipo === "FAMILIA" && !pacoteMembro.titular;
  const titularDaFamilia = membroNaoTitularDeFamilia
    ? pacoteMembro?.pacote.membros.find((m) => m.titular)?.aluno
    : null;

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
            Vencimento
            <input
              name="dataVencimento"
              type="date"
              defaultValue={
                aluno.dataVencimento
                  ? aluno.dataVencimento.toISOString().slice(0, 10)
                  : ""
              }
              className="rounded-md border border-foreground/20 bg-transparent px-3 py-2 outline-none focus:border-primary"
            />
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

        <div className="grid grid-cols-1 gap-4 rounded-md border border-foreground/10 p-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            Pacote (família / combo modalidades)
            <select
              name="pacoteId"
              defaultValue={pacoteMembro?.pacoteId ?? ""}
              className="rounded-md border border-foreground/20 bg-background px-3 py-2 outline-none focus:border-primary"
            >
              <option value="">Nenhum</option>
              {pacotes.map((pacote) => (
                <option key={pacote.id} value={pacote.id}>
                  {pacote.nome} ({labelPacote(pacote.tipo)})
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Desconto do aluno no pacote (%)
            <input
              name="descontoPercentual"
              type="number"
              step="0.01"
              min="0"
              max="100"
              defaultValue={
                pacoteMembro ? Number(pacoteMembro.descontoPercentual) : 0
              }
              className="rounded-md border border-foreground/20 bg-transparent px-3 py-2 outline-none focus:border-primary"
            />
            <span className="text-xs text-foreground/40">
              Só é aplicado se um pacote for selecionado acima.
            </span>
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
          Modalidades matriculadas
        </h2>
        <p className="text-sm text-foreground/60">
          <strong>{aluno.modalidade}</strong> é a modalidade principal (faixa/
          graduação acima). Abaixo, as modalidades extras — cada uma pode ter
          seu próprio vencimento, editável aqui.
        </p>

        {aluno.matriculas.length === 0 ? (
          <p className="text-sm text-foreground/40">
            Nenhuma modalidade extra ainda.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {aluno.matriculas.map((matricula) => (
              <div
                key={matricula.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-surface-hover px-3 py-2 text-sm"
              >
                <span className="text-foreground">
                  {matricula.agendaAula.modalidade}{" "}
                  <span className="text-foreground/40">
                    ({DIA_SEMANA_LABEL[matricula.agendaAula.diaSemana]}{" "}
                    {formatarHora(matricula.agendaAula.horarioInicio)})
                  </span>
                </span>
                <form
                  action={atualizarVencimentoMatricula.bind(null, matricula.id)}
                  className="flex items-center gap-2"
                >
                  <label className="flex items-center gap-2 text-xs text-foreground/60">
                    Vencimento
                    <input
                      name="dataVencimentoBase"
                      type="date"
                      required
                      defaultValue={matricula.dataVencimentoBase.toISOString().slice(0, 10)}
                      className="rounded-md border border-foreground/20 bg-transparent px-2 py-1 outline-none focus:border-primary"
                    />
                  </label>
                  <button type="submit" className="text-xs text-primary hover:underline">
                    salvar
                  </button>
                </form>
              </div>
            ))}
          </div>
        )}
      </div>

      {membroNaoTitularDeFamilia && titularDaFamilia && (
        <div className="rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-foreground">
          Esse aluno faz parte do pacote família{" "}
          <strong>{pacoteMembro?.pacote.nome}</strong> — o titular do login é{" "}
          <strong>{titularDaFamilia.nome}</strong>. A mensalidade dele já
          aparece automaticamente no financeiro do titular.
        </div>
      )}

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
                    mensagemAcessoPortal(
                      aluno.nome,
                      aluno.usuario?.username ?? "",
                      acessoLink,
                    ),
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
                    "Seu acesso ao portal do Centro de Treinamento Sandro Freire",
                  )}&body=${encodeURIComponent(
                    mensagemAcessoPortal(
                      aluno.nome,
                      aluno.usuario?.username ?? "",
                      acessoLink,
                    ),
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
