import { prisma } from "@/lib/prisma";
import { MODALIDADES } from "@/lib/modalidades";

export type TipoPacote = "FAMILIA" | "COMBO_MODALIDADES";

export async function getPrecosModalidade(): Promise<Record<string, number>> {
  const precos = await prisma.modalidadePreco.findMany();
  const mapa = new Map(precos.map((p) => [p.modalidade, Number(p.valor)]));

  return Object.fromEntries(
    MODALIDADES.map((modalidade) => [modalidade, mapa.get(modalidade) ?? 0]),
  );
}

// Soma o preço de cada Matricula extra do aluno — por matrícula, não por
// modalidade distinta: 2 matrículas na mesma modalidade extra (2 horários
// diferentes) somam 2x, porque cada uma gera sua própria cobrança real
// (ver getParcelasCiclo/Matricula.dataVencimentoBase). Usado no "Valor
// total" do financeiro e no desconto de pacotes COMBO_MODALIDADES.
export async function somaExtrasAluno(
  alunoId: string,
  precosModalidade: Record<string, number>,
): Promise<number> {
  const matriculas = await prisma.matricula.findMany({
    where: { alunoId },
    select: { agendaAula: { select: { modalidade: true } } },
  });

  return matriculas.reduce(
    (soma, m) => soma + (precosModalidade[m.agendaAula.modalidade] ?? 0),
    0,
  );
}

export type MembroParaCalculo = {
  descontoPercentual: number;
  pacote: { nome: string; tipo: TipoPacote };
};

export type ValorEfetivoAluno = {
  base: number;
  extras: number;
  descontoPercentual: number;
  total: number;
  pacoteNome: string | null;
  pacoteTipo: TipoPacote | null;
};

// Hierarquia de preço: mensalidadeValor (override do aluno) > preço padrão
// da modalidade. Extras (modalidades extras matriculadas, independente de
// pacote) sempre entram no total — sem isso, o "valor total" do financeiro
// não refletia as modalidades extras de um aluno sem pacote. Pacote FAMILIA
// desconta só a mensalidade (extras somados sem desconto); pacote
// COMBO_MODALIDADES desconta o total combinado (mensalidade + extras).
export async function valorEfetivoAluno(
  aluno: { id: string; modalidade: string; mensalidadeValor: number | null },
  precosModalidade: Record<string, number>,
  membro: MembroParaCalculo | null,
): Promise<ValorEfetivoAluno> {
  const base = aluno.mensalidadeValor ?? precosModalidade[aluno.modalidade] ?? 0;
  const extras = await somaExtrasAluno(aluno.id, precosModalidade);

  if (!membro) {
    return {
      base,
      extras,
      descontoPercentual: 0,
      total: base + extras,
      pacoteNome: null,
      pacoteTipo: null,
    };
  }

  const desconto = membro.descontoPercentual;

  if (membro.pacote.tipo === "FAMILIA") {
    return {
      base,
      extras,
      descontoPercentual: desconto,
      total: base * (1 - desconto / 100) + extras,
      pacoteNome: membro.pacote.nome,
      pacoteTipo: membro.pacote.tipo,
    };
  }

  return {
    base,
    extras,
    descontoPercentual: desconto,
    total: (base + extras) * (1 - desconto / 100),
    pacoteNome: membro.pacote.nome,
    pacoteTipo: membro.pacote.tipo,
  };
}

export type AlunoComPreco = {
  id: string;
  nome: string;
  modalidade: string;
  precoPadrao: number;
  mensalidadeValor: number | null;
  pacoteNome: string | null;
  pacoteTipo: TipoPacote | null;
  descontoPercentual: number;
  valorEfetivo: number;
};

// Alimenta a tabela "Preço individual dos alunos" da aba Preços.
export async function getAlunosComPrecos(): Promise<AlunoComPreco[]> {
  const [alunos, precosModalidade] = await Promise.all([
    prisma.aluno.findMany({
      orderBy: { nome: "asc" },
      include: { pacoteMembro: { include: { pacote: true } } },
    }),
    getPrecosModalidade(),
  ]);

  return Promise.all(
    alunos.map(async (aluno) => {
      const mensalidadeValor =
        aluno.mensalidadeValor !== null ? Number(aluno.mensalidadeValor) : null;
      const membro: MembroParaCalculo | null = aluno.pacoteMembro
        ? {
            descontoPercentual: Number(aluno.pacoteMembro.descontoPercentual),
            pacote: {
              nome: aluno.pacoteMembro.pacote.nome,
              tipo: aluno.pacoteMembro.pacote.tipo as TipoPacote,
            },
          }
        : null;

      const efetivo = await valorEfetivoAluno(
        { id: aluno.id, modalidade: aluno.modalidade, mensalidadeValor },
        precosModalidade,
        membro,
      );

      return {
        id: aluno.id,
        nome: aluno.nome,
        modalidade: aluno.modalidade,
        precoPadrao: precosModalidade[aluno.modalidade] ?? 0,
        mensalidadeValor,
        pacoteNome: efetivo.pacoteNome,
        pacoteTipo: efetivo.pacoteTipo,
        descontoPercentual: efetivo.descontoPercentual,
        valorEfetivo: efetivo.total,
      };
    }),
  );
}

// Alimenta a seção "Pacotes" da aba Preços e o select de vínculo no
// cadastro/edição de aluno.
export async function getPacotes() {
  return prisma.pacote.findMany({
    include: {
      membros: {
        include: { aluno: { select: { id: true, nome: true, modalidade: true } } },
      },
    },
    orderBy: { criadoEm: "desc" },
  });
}

// Combos-catálogo (criados pelo admin sem aluno vinculado ainda) — o aluno
// escolhe um deles no autocadastro/matrícula pra aplicar o desconto de
// combo sozinho. Pacotes FAMILIA nunca entram aqui (sempre montados
// diretamente pelo admin com os membros já definidos).
export async function getPacotesComboDisponiveis() {
  return prisma.pacote.findMany({
    where: { tipo: "COMBO_MODALIDADES", membros: { none: {} } },
    orderBy: { criadoEm: "desc" },
  });
}
