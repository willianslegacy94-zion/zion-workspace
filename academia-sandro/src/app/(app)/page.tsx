import { AlertTriangle, LayoutDashboard, Users, Wallet } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { diasParaVencer } from "@/lib/vencimento";
import { PageHeader } from "@/components/PageHeader";

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const FAIXAS_ETARIAS = [
  { label: "Até 12", min: 0, max: 12 },
  { label: "13-17", min: 13, max: 17 },
  { label: "18-25", min: 18, max: 25 },
  { label: "26-35", min: 26, max: 35 },
  { label: "36-45", min: 36, max: 45 },
  { label: "46+", min: 46, max: 200 },
];

function calcularIdade(dataNascimento: Date): number {
  const hoje = new Date();
  let idade = hoje.getFullYear() - dataNascimento.getFullYear();
  const m = hoje.getMonth() - dataNascimento.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < dataNascimento.getDate())) {
    idade--;
  }
  return idade;
}

function BarraProgresso({
  label,
  valor,
  total,
}: {
  label: string;
  valor: number;
  total: number;
}) {
  const pct = total > 0 ? Math.round((valor / total) * 100) : 0;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-foreground/80">{label}</span>
        <span className="text-foreground/50">
          {valor} ({pct}%)
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-surface-hover">
        <div
          className="h-full rounded-full bg-gold-gradient"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default async function DashboardPage() {
  const [alunos, transacoes, despesas] = await Promise.all([
    prisma.aluno.findMany(),
    prisma.transacaoFinanceira.findMany(),
    prisma.despesa.findMany(),
  ]);

  const hoje = new Date();

  const receitas = transacoes
    .filter((t) => t.tipo === "Receita" && t.dataTransacao <= hoje)
    .reduce((total, t) => total + Number(t.valor), 0);
  const despesasTransacoes = transacoes
    .filter((t) => t.tipo === "Despesa" && t.dataTransacao <= hoje)
    .reduce((total, t) => total + Number(t.valor), 0);
  const despesasAvulsas = despesas
    .filter((d) => d.data <= hoje)
    .reduce((total, d) => total + Number(d.valor), 0);
  const saldo = receitas - despesasTransacoes - despesasAvulsas;

  const alunosVencendo = alunos.filter(
    (a) => a.dataVencimento && diasParaVencer(a.dataVencimento) <= 3,
  );

  const modalidadeCounts = alunos.reduce<Record<string, number>>((acc, a) => {
    acc[a.modalidade] = (acc[a.modalidade] ?? 0) + 1;
    return acc;
  }, {});
  const rankingModalidades = Object.entries(modalidadeCounts).sort(
    (a, b) => b[1] - a[1],
  );

  const idades = alunos
    .filter((a) => a.dataNascimento)
    .map((a) => calcularIdade(a.dataNascimento as Date));
  const faixasComContagem = FAIXAS_ETARIAS.map((faixa) => ({
    label: faixa.label,
    count: idades.filter((idade) => idade >= faixa.min && idade <= faixa.max)
      .length,
  }));

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-12">
      <PageHeader
        icon={LayoutDashboard}
        title="Dashboard"
        subtitle="Visão geral da academia — alunos, financeiro e alertas de matrícula"
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="card-premium flex items-start justify-between p-6">
          <div>
            <p className="text-xs uppercase tracking-wider text-foreground/50">
              Total de alunos
            </p>
            <p className="mt-2 text-3xl font-bold text-primary">
              {alunos.length}
            </p>
          </div>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <Users size={18} className="text-primary" />
          </div>
        </div>
        <div className="card-premium flex items-start justify-between p-6">
          <div>
            <p className="text-xs uppercase tracking-wider text-foreground/50">
              Saldo financeiro
            </p>
            <p
              className={`mt-2 text-3xl font-bold ${saldo >= 0 ? "text-success" : "text-error"}`}
            >
              {currency.format(saldo)}
            </p>
          </div>
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${saldo >= 0 ? "bg-success/10" : "bg-error/10"}`}
          >
            <Wallet
              size={18}
              className={saldo >= 0 ? "text-success" : "text-error"}
            />
          </div>
        </div>
        <div className="card-premium flex items-start justify-between p-6">
          <div>
            <p className="text-xs uppercase tracking-wider text-foreground/50">
              Vencendo em 3 dias
            </p>
            <p className="mt-2 text-3xl font-bold text-warning">
              {alunosVencendo.length}
            </p>
          </div>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-warning/10">
            <AlertTriangle size={18} className="text-warning" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div className="card-premium flex flex-col gap-4 p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground/60">
            Ranking de modalidades
          </h2>
          {rankingModalidades.length === 0 && (
            <p className="text-sm text-foreground/40">
              Nenhum aluno cadastrado ainda.
            </p>
          )}
          {rankingModalidades.map(([modalidade, count]) => (
            <BarraProgresso
              key={modalidade}
              label={modalidade}
              valor={count}
              total={alunos.length}
            />
          ))}
        </div>

        <div className="card-premium flex flex-col gap-4 p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground/60">
            Faixa etária
          </h2>
          {idades.length === 0 && (
            <p className="text-sm text-foreground/40">
              Nenhum aluno com data de nascimento cadastrada ainda.
            </p>
          )}
          {idades.length > 0 &&
            faixasComContagem.map((faixa) => (
              <BarraProgresso
                key={faixa.label}
                label={faixa.label}
                valor={faixa.count}
                total={idades.length}
              />
            ))}
        </div>
      </div>
    </div>
  );
}
