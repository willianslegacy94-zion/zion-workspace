import Link from "next/link";
import {
  CalendarClock,
  Clock,
  CalendarX,
  ListPlus,
  Package,
  Tag,
  Trash2,
  Users,
} from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getPrecosModalidade, getAlunosComPrecos, getPacotes } from "@/lib/precos";
import { getConfiguracaoAgenda } from "@/lib/configuracao-agenda";
import { getBloqueiosFuturos } from "@/lib/bloqueios-agenda";
import { DIAS_GRADE, DIA_SEMANA_LABEL, formatarHora } from "@/lib/agenda-constants";
import { MODALIDADES } from "@/lib/modalidades";
import { CriarPacoteForm } from "@/components/CriarPacoteForm";
import { WhatsappConexao } from "@/components/WhatsappConexao";
import {
  atualizarCapacidadeAula,
  atualizarPerfil,
  criarAula,
  criarBloqueio,
  excluirAula,
  excluirBloqueio,
  salvarConfiguracaoAgenda,
} from "./actions";
import {
  atribuirAlunoPacote,
  atualizarDescontoMembro,
  atualizarMensalidadeAluno,
  definirTitular,
  excluirPacote,
  removerMembroPacote,
  salvarPrecosModalidade,
} from "./precos-actions";

type Aba = "perfil" | "agenda" | "precos" | "whatsapp";

const moeda = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function labelPacote(tipo: string) {
  return tipo === "FAMILIA" ? "Família" : "Combo modalidades";
}

function abaClasse(ativa: boolean) {
  const base = "rounded-full px-4 py-1.5 text-sm font-medium transition-colors";
  return ativa
    ? `${base} bg-primary text-background`
    : `${base} border border-foreground/20 text-foreground/70 hover:bg-foreground/5`;
}

export default async function ConfiguracoesPage({
  searchParams,
}: {
  searchParams: Promise<{ aba?: Aba; sucesso?: string; erro?: string }>;
}) {
  const { aba = "perfil", sucesso, erro } = await searchParams;
  const session = await auth();

  const usuario = session?.user?.id
    ? await prisma.usuario.findUnique({
        where: { id: session.user.id },
        select: { nome: true, email: true, telefone: true, pix: true, username: true },
      })
    : null;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6">
      <div>
        <h1 className="mb-1 font-serif text-2xl font-bold text-primary">
          Configurações
        </h1>
        <p className="text-sm text-foreground/50">
          Perfil de administrador e gestão da agenda ({usuario?.username}).
        </p>
      </div>

      <div className="flex gap-2">
        <Link href="/configuracoes?aba=perfil" className={abaClasse(aba === "perfil")}>
          Perfil
        </Link>
        <Link href="/configuracoes?aba=agenda" className={abaClasse(aba === "agenda")}>
          Agenda
        </Link>
        <Link href="/configuracoes?aba=precos" className={abaClasse(aba === "precos")}>
          Preços
        </Link>
        <Link href="/configuracoes?aba=whatsapp" className={abaClasse(aba === "whatsapp")}>
          WhatsApp
        </Link>
      </div>

      {aba === "perfil" ? (
        <div className="w-full max-w-lg">
          <div className="card-premium p-8">
            <form action={atualizarPerfil} className="flex flex-col gap-4">
              <div>
                <label className="mb-1.5 block text-xs uppercase tracking-wider text-foreground/50">
                  Nome
                </label>
                <input
                  name="nome"
                  required
                  defaultValue={usuario?.nome ?? ""}
                  placeholder="Seu nome completo"
                  className="input-dark w-full"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs uppercase tracking-wider text-foreground/50">
                  E-mail
                </label>
                <input
                  name="email"
                  type="email"
                  required
                  defaultValue={usuario?.email ?? ""}
                  placeholder="seu@email.com"
                  className="input-dark w-full"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs uppercase tracking-wider text-foreground/50">
                  Telefone
                </label>
                <input
                  name="telefone"
                  defaultValue={usuario?.telefone ?? ""}
                  placeholder="(11) 91234-5678"
                  className="input-dark w-full"
                />
                <p className="mt-1 text-xs text-foreground/40">
                  Pra onde chegam os avisos administrativos (ex: aula
                  experimental agendada) — pode ser diferente do número
                  conectado na aba WhatsApp, que é quem envia as mensagens.
                </p>
              </div>

              <div>
                <label className="mb-1.5 block text-xs uppercase tracking-wider text-foreground/50">
                  Chave PIX
                </label>
                <input
                  name="pix"
                  defaultValue={usuario?.pix ?? ""}
                  placeholder="E-mail, telefone, CPF ou chave aleatória"
                  className="input-dark w-full"
                />
                <p className="mt-1 text-xs text-foreground/40">
                  Aparece pro aluno em Financeiro, na hora de pagar.
                </p>
              </div>

              {sucesso && (
                <p className="rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-center text-xs text-success animate-fade-in">
                  Dados atualizados com sucesso.
                </p>
              )}

              {erro && (
                <p className="rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-center text-xs text-error animate-fade-in">
                  {erro}
                </p>
              )}

              <button type="submit" className="btn-gold mt-2 w-full">
                Salvar alterações
              </button>
            </form>
          </div>
        </div>
      ) : aba === "agenda" ? (
        <AbaAgenda />
      ) : aba === "precos" ? (
        <AbaPrecos />
      ) : (
        <AbaWhatsapp />
      )}
    </div>
  );
}

function AbaWhatsapp() {
  return (
    <div className="flex w-full max-w-lg flex-col gap-4 rounded-lg border border-foreground/10 p-6">
      <h2 className="text-lg font-semibold text-foreground">
        Conexão do WhatsApp
      </h2>
      <p className="text-sm text-foreground/50">
        Pareie o número do CT pra enviar automaticamente: avisos de bloqueio
        de agenda pro aluno e avisos de agendamento de aula experimental pra
        você, sem precisar clicar em nada. Esse é o número que{" "}
        <strong>envia</strong> as mensagens — diferente do campo Telefone em
        Configurações → Perfil, que é só pra onde os avisos administrativos
        chegam (normalmente é o mesmo número, mas não precisa ser).
      </p>
      <WhatsappConexao />
    </div>
  );
}

async function AbaAgenda() {
  const [configAgenda, bloqueios, aulas] = await Promise.all([
    getConfiguracaoAgenda(),
    getBloqueiosFuturos(),
    prisma.agendaAula.findMany({
      orderBy: [{ modalidade: "asc" }, { diaSemana: "asc" }, { horarioInicio: "asc" }],
    }),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4 rounded-lg border border-foreground/10 p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
          <Clock size={18} className="text-primary" />
          Horário de almoço
        </h2>
        <p className="text-sm text-foreground/50">
          Intervalo bloqueado pra criação de novos horários — vale pra todas as
          modalidades e dias.
        </p>
        <form action={salvarConfiguracaoAgenda} className="flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-1 text-sm">
            Início
            <input
              name="almocoInicio"
              type="time"
              defaultValue={configAgenda.almocoInicio ?? ""}
              className="rounded-md border border-foreground/20 bg-transparent px-3 py-2 outline-none focus:border-primary"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Fim
            <input
              name="almocoFim"
              type="time"
              defaultValue={configAgenda.almocoFim ?? ""}
              className="rounded-md border border-foreground/20 bg-transparent px-3 py-2 outline-none focus:border-primary"
            />
          </label>
          <button
            type="submit"
            className="rounded-md bg-primary px-5 py-2 text-sm font-medium text-background transition-colors hover:bg-secondary"
          >
            Salvar
          </button>
        </form>
      </div>

      <div className="flex flex-col gap-4 rounded-lg border border-foreground/10 p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
          <CalendarX size={18} className="text-primary" />
          Bloqueios pontuais (compromissos)
        </h2>
        <p className="text-sm text-foreground/50">
          Avisa os alunos de que não vai ter aula num dia específico — não
          cancela matrículas automaticamente, é um aviso pro aluno não
          aparecer à toa.
        </p>
        <form action={criarBloqueio} className="flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-1 text-sm">
            Data
            <input
              name="data"
              type="date"
              required
              className="rounded-md border border-foreground/20 bg-transparent px-3 py-2 outline-none focus:border-primary"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Das
            <input
              name="horaInicio"
              type="time"
              required
              className="rounded-md border border-foreground/20 bg-transparent px-3 py-2 outline-none focus:border-primary"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Até
            <input
              name="horaFim"
              type="time"
              required
              className="rounded-md border border-foreground/20 bg-transparent px-3 py-2 outline-none focus:border-primary"
            />
          </label>
          <label className="flex flex-1 min-w-[180px] flex-col gap-1 text-sm">
            Motivo (opcional)
            <input
              name="motivo"
              placeholder="Ex: consulta médica"
              className="rounded-md border border-foreground/20 bg-transparent px-3 py-2 outline-none focus:border-primary"
            />
          </label>
          <button
            type="submit"
            className="rounded-md bg-primary px-5 py-2 text-sm font-medium text-background transition-colors hover:bg-secondary"
          >
            Bloquear
          </button>
        </form>

        {bloqueios.length > 0 && (
          <div className="flex flex-col gap-2">
            {bloqueios.map((bloqueio) => (
              <div
                key={bloqueio.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-warning/30 bg-warning/10 px-4 py-2.5 text-sm"
              >
                <span className="text-foreground">
                  <strong>{bloqueio.dataFormatada}</strong> · {bloqueio.horaInicio}–
                  {bloqueio.horaFim}
                  {bloqueio.motivo && ` — ${bloqueio.motivo}`}
                </span>
                <form action={excluirBloqueio.bind(null, bloqueio.id)}>
                  <button
                    type="submit"
                    aria-label="Excluir bloqueio"
                    className="text-foreground/40 transition-colors hover:text-error"
                  >
                    <Trash2 size={16} />
                  </button>
                </form>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4 rounded-lg border border-foreground/10 p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
          <ListPlus size={18} className="text-primary" />
          Gerenciar horários e aulas
        </h2>
        <form action={criarAula} className="flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-1 text-sm">
            Modalidade
            <select
              name="modalidade"
              required
              className="rounded-md border border-foreground/20 bg-transparent px-3 py-2 outline-none focus:border-primary"
            >
              {MODALIDADES.map((modalidade) => (
                <option key={modalidade} value={modalidade}>
                  {modalidade}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Dia
            <select
              name="diaSemana"
              required
              className="rounded-md border border-foreground/20 bg-transparent px-3 py-2 outline-none focus:border-primary"
            >
              {DIAS_GRADE.map((dia) => (
                <option key={dia} value={dia}>
                  {DIA_SEMANA_LABEL[dia]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Horário
            <input
              name="hora"
              type="time"
              required
              className="rounded-md border border-foreground/20 bg-transparent px-3 py-2 outline-none focus:border-primary"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Capacidade
            <input
              name="capacidadeMax"
              type="number"
              min="1"
              defaultValue={10}
              className="w-24 rounded-md border border-foreground/20 bg-transparent px-3 py-2 outline-none focus:border-primary"
            />
          </label>
          <button
            type="submit"
            className="rounded-md bg-primary px-5 py-2 text-sm font-medium text-background transition-colors hover:bg-secondary"
          >
            Adicionar horário
          </button>
        </form>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-surface-border text-left text-xs font-semibold uppercase tracking-wider text-foreground/50">
                <th className="py-2">Modalidade</th>
                <th className="py-2">Dia</th>
                <th className="py-2">Horário</th>
                <th className="py-2">Capacidade</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {aulas.map((aula) => (
                <tr key={aula.id} className="border-b border-surface-border/50">
                  <td className="py-2 text-foreground">{aula.modalidade}</td>
                  <td className="py-2 text-foreground/70">
                    {DIA_SEMANA_LABEL[aula.diaSemana]}
                  </td>
                  <td className="py-2 text-foreground/70">
                    {formatarHora(aula.horarioInicio)}
                  </td>
                  <td className="py-2">
                    <form
                      action={atualizarCapacidadeAula.bind(null, aula.id)}
                      className="flex items-center gap-2"
                    >
                      <input
                        name="capacidadeMax"
                        type="number"
                        min="1"
                        defaultValue={aula.capacidadeMax}
                        className="w-16 rounded-md border border-foreground/20 bg-transparent px-2 py-1 outline-none focus:border-primary"
                      />
                      <button
                        type="submit"
                        className="text-xs text-primary hover:underline"
                      >
                        salvar
                      </button>
                    </form>
                  </td>
                  <td className="py-2 text-right">
                    <form action={excluirAula.bind(null, aula.id)}>
                      <button
                        type="submit"
                        aria-label="Excluir horário"
                        className="text-foreground/40 transition-colors hover:text-error"
                      >
                        <Trash2 size={16} />
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Link
        href="/agenda"
        className="flex w-fit items-center gap-2 text-sm text-foreground/50 transition-colors hover:text-primary"
      >
        <CalendarClock size={15} />
        Ver a grade completa em /agenda
      </Link>
    </div>
  );
}

async function AbaPrecos() {
  const [precos, alunosComPrecos, pacotes, alunosSemPacote] = await Promise.all([
    getPrecosModalidade(),
    getAlunosComPrecos(),
    getPacotes(),
    prisma.aluno.findMany({
      where: { pacoteMembro: null },
      select: { id: true, nome: true, modalidade: true },
      orderBy: { nome: "asc" },
    }),
  ]);

  const pacotesCombo = pacotes.filter((p) => p.tipo === "COMBO_MODALIDADES");
  const pacotesFamilia = pacotes.filter((p) => p.tipo === "FAMILIA");

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4 rounded-lg border border-foreground/10 p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
          <Tag size={18} className="text-primary" />
          Preços por modalidade
        </h2>
        <p className="text-sm text-foreground/50">
          Valor padrão da modalidade — usado como base da mensalidade e
          cobrado do aluno quando ele se matricula numa modalidade extra
          (além da principal) pela aba Matrícula do portal dele.
        </p>
        <form action={salvarPrecosModalidade} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {Object.entries(precos).map(([modalidade, valor]) => (
              <label key={modalidade} className="flex flex-col gap-1 text-sm">
                {modalidade}
                <div className="flex items-center gap-1">
                  <span className="text-foreground/40">R$</span>
                  <input
                    name={`preco_${modalidade}`}
                    type="number"
                    step="0.01"
                    min="0"
                    defaultValue={valor}
                    className="w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 outline-none focus:border-primary"
                  />
                </div>
              </label>
            ))}
          </div>
          <button
            type="submit"
            className="self-start rounded-md bg-primary px-5 py-2 text-sm font-medium text-background transition-colors hover:bg-secondary"
          >
            Salvar preços
          </button>
        </form>
      </div>

      <div className="flex flex-col gap-4 rounded-lg border border-foreground/10 p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
          <Package size={18} className="text-primary" />
          Pacotes Combo (aparecem pro aluno escolher)
        </h2>
        <p className="text-sm text-foreground/50">
          Um único aluno que pratica 2+ modalidades, com desconto sobre o
          valor total combinado. Crie sem vincular um aluno pra virar um
          modelo de catálogo — ele aparece pro próprio aluno escolher no
          autocadastro/matrícula. Quer atribuir manualmente depois? Use
          &quot;Atribuir aluno&quot; no pacote sem integrante.
        </p>

        {pacotesCombo.length > 0 && (
          <div className="flex flex-col gap-3">
            {pacotesCombo.map((pacote) => (
              <div
                key={pacote.id}
                className="flex flex-col gap-3 rounded-md border border-foreground/10 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">
                      {pacote.nome}
                    </span>
                    {pacote.membros.length === 0 && (
                      <span className="rounded-full bg-warning/15 px-2 py-0.5 text-xs font-medium text-warning">
                        Catálogo — sem aluno ainda
                      </span>
                    )}
                  </div>
                  <form action={excluirPacote.bind(null, pacote.id)}>
                    <button
                      type="submit"
                      className="text-xs text-error hover:underline"
                    >
                      Excluir pacote
                    </button>
                  </form>
                </div>

                {pacote.membros.length === 0 ? (
                  <form
                    action={atribuirAlunoPacote.bind(null, pacote.id)}
                    className="flex flex-wrap items-end gap-3"
                  >
                    <label className="flex flex-1 min-w-[200px] flex-col gap-1 text-xs text-foreground/60">
                      Atribuir aluno
                      <select
                        name="alunoId"
                        required
                        defaultValue=""
                        className="rounded-md border border-foreground/20 bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                      >
                        <option value="" disabled>
                          Selecione
                        </option>
                        {alunosSemPacote.map((aluno) => (
                          <option key={aluno.id} value={aluno.id}>
                            {aluno.nome} ({aluno.modalidade})
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="submit"
                      className="rounded-md bg-primary px-4 py-2 text-xs font-medium text-background transition-colors hover:bg-secondary"
                    >
                      Atribuir
                    </button>
                  </form>
                ) : (
                  <div className="flex flex-col gap-2">
                    {pacote.membros.map((membro) => (
                      <div
                        key={membro.id}
                        className="flex flex-wrap items-center gap-3 rounded-md bg-surface-hover px-3 py-2 text-sm"
                      >
                        <span className="flex-1 text-foreground">{membro.aluno.nome}</span>
                        <form
                          action={atualizarDescontoMembro.bind(null, membro.id)}
                          className="flex items-center gap-1"
                        >
                          <input
                            name="descontoPercentual"
                            type="number"
                            step="0.01"
                            min="0"
                            max="100"
                            defaultValue={Number(membro.descontoPercentual)}
                            className="w-20 rounded-md border border-foreground/20 bg-transparent px-2 py-1 outline-none focus:border-primary"
                          />
                          <button
                            type="submit"
                            className="text-xs text-primary hover:underline"
                          >
                            salvar %
                          </button>
                        </form>
                        <form action={removerMembroPacote.bind(null, membro.id)}>
                          <button
                            type="submit"
                            aria-label="Remover integrante"
                            className="text-foreground/40 transition-colors hover:text-error"
                          >
                            <Trash2 size={14} />
                          </button>
                        </form>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="rounded-md border border-dashed border-foreground/15 p-4">
          <p className="mb-3 text-sm font-medium text-foreground">
            Criar novo pacote combo
          </p>
          <CriarPacoteForm alunos={alunosSemPacote} tipoFixo="COMBO_MODALIDADES" />
        </div>
      </div>

      <div className="flex flex-col gap-4 rounded-lg border border-foreground/10 p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
          <Users size={18} className="text-primary" />
          Pacote Família (só admin monta)
        </h2>
        <p className="text-sm text-foreground/50">
          Vários alunos diferentes, cada um com seu % de desconto na
          mensalidade — só o titular tem login e vê a mensalidade de todos na
          aba Financeiro dele. Sempre montado aqui pelo admin com os membros
          já definidos; nunca aparece pro aluno escolher sozinho.
        </p>

        {pacotesFamilia.length > 0 && (
          <div className="flex flex-col gap-3">
            {pacotesFamilia.map((pacote) => (
              <div
                key={pacote.id}
                className="flex flex-col gap-3 rounded-md border border-foreground/10 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-foreground">{pacote.nome}</span>
                  <form action={excluirPacote.bind(null, pacote.id)}>
                    <button
                      type="submit"
                      className="text-xs text-error hover:underline"
                    >
                      Excluir pacote
                    </button>
                  </form>
                </div>

                <div className="flex flex-col gap-2">
                  {pacote.membros.map((membro) => (
                    <div
                      key={membro.id}
                      className="flex flex-wrap items-center gap-3 rounded-md bg-surface-hover px-3 py-2 text-sm"
                    >
                      <span className="flex-1 text-foreground">
                        {membro.aluno.nome}
                        {membro.titular && (
                          <span className="ml-2 rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-success">
                            Titular
                          </span>
                        )}
                      </span>

                      <form
                        action={atualizarDescontoMembro.bind(null, membro.id)}
                        className="flex items-center gap-1"
                      >
                        <input
                          name="descontoPercentual"
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          defaultValue={Number(membro.descontoPercentual)}
                          className="w-20 rounded-md border border-foreground/20 bg-transparent px-2 py-1 outline-none focus:border-primary"
                        />
                        <button
                          type="submit"
                          className="text-xs text-primary hover:underline"
                        >
                          salvar %
                        </button>
                      </form>

                      {!membro.titular && (
                        <form
                          action={definirTitular.bind(
                            null,
                            pacote.id,
                            membro.alunoId,
                          )}
                        >
                          <button
                            type="submit"
                            className="text-xs text-foreground/60 hover:underline"
                          >
                            tornar titular
                          </button>
                        </form>
                      )}

                      <form action={removerMembroPacote.bind(null, membro.id)}>
                        <button
                          type="submit"
                          aria-label="Remover integrante"
                          className="text-foreground/40 transition-colors hover:text-error"
                        >
                          <Trash2 size={14} />
                        </button>
                      </form>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="rounded-md border border-dashed border-foreground/15 p-4">
          <p className="mb-3 text-sm font-medium text-foreground">
            Criar novo pacote família
          </p>
          <CriarPacoteForm alunos={alunosSemPacote} tipoFixo="FAMILIA" />
        </div>
      </div>

      <div className="flex flex-col gap-4 rounded-lg border border-foreground/10 p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
          <Tag size={18} className="text-primary" />
          Preço individual dos alunos
        </h2>
        <p className="text-sm text-foreground/50">
          Override do valor de mensalidade por aluno — útil quando 2 alunos
          da mesma modalidade pagam valores diferentes. Vazio = usa o preço
          padrão da modalidade.
        </p>

        <div className="overflow-x-auto rounded-lg border border-surface-border">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-surface-border text-foreground/60">
              <tr>
                <th className="px-4 py-3 font-medium">Nome</th>
                <th className="px-4 py-3 font-medium">Modalidade</th>
                <th className="px-4 py-3 font-medium">Preço padrão</th>
                <th className="px-4 py-3 font-medium">Override</th>
                <th className="px-4 py-3 font-medium">Pacote</th>
                <th className="px-4 py-3 font-medium">Valor efetivo</th>
              </tr>
            </thead>
            <tbody>
              {alunosComPrecos.map((aluno) => (
                <tr
                  key={aluno.id}
                  className="border-b border-surface-border last:border-0"
                >
                  <td className="px-4 py-3 text-foreground">{aluno.nome}</td>
                  <td className="px-4 py-3 text-foreground/70">
                    {aluno.modalidade}
                  </td>
                  <td className="px-4 py-3 text-foreground/70">
                    {moeda.format(aluno.precoPadrao)}
                  </td>
                  <td className="px-4 py-3">
                    <form
                      action={atualizarMensalidadeAluno.bind(null, aluno.id)}
                      className="flex items-center gap-1"
                    >
                      <input
                        name="mensalidadeValor"
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="—"
                        defaultValue={aluno.mensalidadeValor ?? ""}
                        className="w-24 rounded-md border border-foreground/20 bg-transparent px-2 py-1 outline-none focus:border-primary"
                      />
                      <button
                        type="submit"
                        className="text-xs text-primary hover:underline"
                      >
                        salvar
                      </button>
                    </form>
                  </td>
                  <td className="px-4 py-3 text-foreground/70">
                    {aluno.pacoteNome ? (
                      <>
                        {aluno.pacoteNome}{" "}
                        <span className="text-foreground/40">
                          ({labelPacote(aluno.pacoteTipo!)},{" "}
                          {aluno.descontoPercentual}%)
                        </span>
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 font-medium text-primary">
                    {moeda.format(aluno.valorEfetivo)}
                  </td>
                </tr>
              ))}
              {alunosComPrecos.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-foreground/50">
                    Nenhum aluno cadastrado ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
