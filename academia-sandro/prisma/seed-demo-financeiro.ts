import "dotenv/config";
import crypto from "node:crypto";
import { prisma } from "../src/lib/prisma";

// Transações e despesas fictícias para demonstração — complementa prisma/seed-demo.ts.

function mesesAtras(n: number): Date {
  const data = new Date();
  data.setMonth(data.getMonth() - n);
  return data;
}

const PRECO_MENSALIDADE: Record<string, number> = {
  "Jiu-Jitsu": 180,
  "Muay Thai": 170,
  Judô: 160,
  Boxe: 150,
  Outra: 140,
};

const NOMES_COM_EXAME_PAGO = [
  "Bruno Martins Silva",
  "Ana Beatriz Souza",
  "Mariana Teixeira Barbosa",
];

async function main() {
  const [transacoesExistentes, despesasExistentes] = await Promise.all([
    prisma.transacaoFinanceira.count(),
    prisma.despesa.count(),
  ]);

  if (transacoesExistentes > 0 || despesasExistentes > 0) {
    console.log(
      "Já existem transações e/ou despesas na base — seed financeiro não roda de novo pra não duplicar. Apague os registros existentes se quiser gerar de novo.",
    );
    return;
  }

  const alunos = await prisma.aluno.findMany({ orderBy: { nome: "asc" } });

  if (alunos.length === 0) {
    throw new Error(
      "Nenhum aluno encontrado — rode `npm run db:seed-demo` primeiro.",
    );
  }

  let transacoesCriadas = 0;

  // Mensalidades — cada aluno paga 2 ou 3 meses de histórico, alternando.
  for (let i = 0; i < alunos.length; i++) {
    const aluno = alunos[i];
    const preco = PRECO_MENSALIDADE[aluno.modalidade] ?? 150;
    const meses = i % 2 === 0 ? 2 : 3;

    for (let m = meses - 1; m >= 0; m--) {
      await prisma.transacaoFinanceira.create({
        data: {
          tipo: "Receita",
          categoria: "Mensalidade",
          valor: preco,
          dataTransacao: mesesAtras(m),
          alunoId: aluno.id,
        },
      });
      transacoesCriadas++;
    }
  }

  // Exames de graduação pagos pelos alunos aptos.
  for (const nome of NOMES_COM_EXAME_PAGO) {
    const aluno = alunos.find((a) => a.nome === nome);
    if (!aluno) continue;

    await prisma.transacaoFinanceira.create({
      data: {
        tipo: "Receita",
        categoria: "Exame de Graduação",
        valor: 100,
        dataTransacao: mesesAtras(1),
        alunoId: aluno.id,
      },
    });
    transacoesCriadas++;
  }

  // Despesas avulsas registradas direto em Transações (sem vínculo a aluno).
  const despesasAvulsasTransacao = [
    { categoria: "Material", valor: 150, meses: 1 },
    { categoria: "Evento", valor: 300, meses: 2 },
  ];
  for (const d of despesasAvulsasTransacao) {
    await prisma.transacaoFinanceira.create({
      data: {
        tipo: "Despesa",
        categoria: d.categoria,
        valor: d.valor,
        dataTransacao: mesesAtras(d.meses),
        alunoId: null,
      },
    });
    transacoesCriadas++;
  }

  // Despesas recorrentes — Aluguel e Salário do professor auxiliar,
  // com 2 meses passados + mês atual + 1 mês futuro (demonstra a recorrência
  // sem inflar o saldo hoje — o dashboard só soma despesas até a data de hoje).
  let despesasCriadas = 0;
  const recorrentes = [
    { categoria: "Aluguel", descricao: "Aluguel do espaço", valor: 1500 },
    { categoria: "Salário", descricao: "Professor auxiliar", valor: 800 },
  ];

  for (const r of recorrentes) {
    const grupoRecorrenciaId = crypto.randomUUID();
    for (const m of [-2, -1, 0, 1]) {
      const data = new Date();
      data.setMonth(data.getMonth() - m);
      await prisma.despesa.create({
        data: {
          categoria: r.categoria,
          descricao: r.descricao,
          valor: r.valor,
          data,
          recorrente: true,
          frequenciaRecorrencia: "Mensal",
          grupoRecorrenciaId,
        },
      });
      despesasCriadas++;
    }
  }

  // Despesas avulsas (não recorrentes) em categorias variadas.
  const avulsas = [
    { categoria: "Manutenção", descricao: "Manutenção do tatame", valor: 250, meses: 1 },
    { categoria: "Equipamento", descricao: "Luvas e protetores novos", valor: 380, meses: 1 },
    { categoria: "Marketing", descricao: "Anúncios Instagram/Facebook", valor: 200, meses: 0 },
    { categoria: "Utilidades", descricao: "Conta de energia", valor: 220, meses: 0 },
    { categoria: "Utilidades", descricao: "Conta de água", valor: 90, meses: 1 },
    { categoria: "Impostos", descricao: "Taxa de federação", valor: 300, meses: 2 },
    { categoria: "Outros", descricao: "Material de limpeza", valor: 60, meses: 0 },
  ];

  for (const a of avulsas) {
    await prisma.despesa.create({
      data: {
        categoria: a.categoria,
        descricao: a.descricao,
        valor: a.valor,
        data: mesesAtras(a.meses),
        recorrente: false,
      },
    });
    despesasCriadas++;
  }

  console.log(
    `Seed financeiro concluído: ${transacoesCriadas} transação(ões) e ${despesasCriadas} despesa(s) criadas.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
