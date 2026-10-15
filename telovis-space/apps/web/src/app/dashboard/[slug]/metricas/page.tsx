import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { getAdminSpace } from "@/lib/space/admin";
import { formatDuration } from "@/lib/metrics/summarize";
import { getSpaceUsage, PERIODS, type Period } from "@/lib/metrics/usage";

// Datas exibidas no mesmo fuso usado para agrupar os dias.
const OFFSET_MS = Number(process.env.METRICS_TZ_OFFSET_MINUTES ?? -180) * 60_000;
const shift = (t: number) => new Date(t + OFFSET_MS);
const fmtDay = (day: string) => `${day.slice(8, 10)}/${day.slice(5, 7)}`;
const fmtDateTime = (t: number) =>
  shift(t).toLocaleString("pt-BR", { timeZone: "UTC", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export default async function MetricsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ dias?: string }>;
}) {
  const { slug } = await params;
  const user = await requireUser(`/dashboard/${slug}/metricas`);
  const admin = await getAdminSpace(slug, user.id);
  if (!admin) {
    return (
      <main className="grid min-h-dvh place-items-center p-6 text-center">
        <div>
          <h1 className="text-2xl font-semibold">Sem acesso</h1>
          <p className="mt-2 text-slate-400">Só administradores do escritório veem as métricas.</p>
          <Link href="/dashboard" className="mt-6 inline-block text-emerald-400 underline">
            Voltar ao dashboard
          </Link>
        </div>
      </main>
    );
  }

  const asked = Number((await searchParams).dias);
  const period: Period = (PERIODS as readonly number[]).includes(asked) ? (asked as Period) : 7;
  const space = await prisma.space.findUniqueOrThrow({
    where: { id: admin.id },
    select: { id: true, mapJsonUrl: true },
  });
  const usage = await getSpaceUsage(space, period);
  const maxDay = Math.max(1, ...usage.days.map((d) => d.seconds));
  const talkShare = usage.totalSeconds ? Math.round((usage.talkSeconds / usage.totalSeconds) * 100) : 0;
  // Rótulos do eixo: todos em 7 dias; espaçados em 30/90.
  const labelEvery = period === 7 ? 1 : period === 30 ? 5 : 15;

  return (
    <main className="mx-auto max-w-4xl p-6 sm:p-8">
      <Link href={`/dashboard/${slug}`} className="text-sm text-slate-400 hover:text-slate-200">
        ← {admin.name}
      </Link>
      <header className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Métricas de uso</h1>
        <nav aria-label="Período" className="flex gap-1 rounded-lg border border-slate-800 p-1 text-sm">
          {PERIODS.map((p) => (
            <Link
              key={p}
              href={`/dashboard/${slug}/metricas?dias=${p}`}
              aria-current={p === period ? "page" : undefined}
              className={`rounded-md px-3 py-1 ${p === period ? "bg-emerald-500 text-black" : "text-slate-300 hover:bg-white/5"}`}
            >
              {p} dias
            </Link>
          ))}
        </nav>
      </header>

      {usage.activePeople === 0 ? (
        <p className="mt-10 rounded-xl border border-slate-800 p-6 text-slate-400">
          Ninguém entrou no escritório nos últimos {period} dias. As métricas aparecem conforme as
          pessoas usam o espaço (visitas com menos de 5 segundos não contam).
        </p>
      ) : (
        <>
          <section aria-label="Resumo" className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Tempo no escritório" value={formatDuration(usage.totalSeconds)} />
            <Stat label="Pessoas ativas" value={String(usage.activePeople)} />
            <Stat
              label="Pico simultâneo"
              value={`${usage.peak.people} ${usage.peak.people === 1 ? "pessoa" : "pessoas"}`}
              hint={usage.peak.at ? fmtDateTime(usage.peak.at) : undefined}
            />
            <Stat
              label="Conversando"
              value={formatDuration(usage.talkSeconds)}
              hint={`${talkShare}% do tempo · ${usage.messages} mensagens`}
            />
          </section>

          <section className="mt-8">
            <h2 className="text-lg font-semibold">Por dia</h2>
            <div className="mt-3 rounded-xl border border-slate-800 p-4">
              <div className="flex h-40 items-end gap-[2px]" role="img" aria-label="Tempo no escritório por dia">
                {usage.days.map((d) => (
                  <div
                    key={d.day}
                    title={`${fmtDay(d.day)}: ${formatDuration(d.seconds)} · ${d.people} ${d.people === 1 ? "pessoa" : "pessoas"}`}
                    className="flex h-full min-w-0 flex-1 items-end"
                  >
                    <div
                      className="w-full rounded-t bg-emerald-500/80 hover:bg-emerald-400"
                      style={{ height: `${d.seconds ? Math.max(2, (d.seconds / maxDay) * 100) : 0}%` }}
                    />
                  </div>
                ))}
              </div>
              <div className="mt-1 flex gap-[2px] text-[10px] text-slate-500">
                {usage.days.map((d, i) => (
                  <span key={d.day} className="min-w-0 flex-1 text-center">
                    {i % labelEvery === 0 ? fmtDay(d.day) : ""}
                  </span>
                ))}
              </div>
            </div>
          </section>

          <section className="mt-8">
            <h2 className="text-lg font-semibold">Por pessoa</h2>
            <div className="mt-3 overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full min-w-[560px] text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="p-3 font-medium">Pessoa</th>
                    <th className="p-3 font-medium">Tempo</th>
                    <th className="p-3 font-medium">Dias ativos</th>
                    <th className="p-3 font-medium">Média/dia</th>
                    <th className="p-3 font-medium">Conversando</th>
                    <th className="p-3 font-medium">Mensagens</th>
                    <th className="p-3 font-medium">Última vez</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {usage.people.map((p) => (
                    <tr key={p.userId}>
                      <td className="p-3 font-medium">{usage.names.get(p.userId) ?? "—"}</td>
                      <td className="p-3">{formatDuration(p.seconds)}</td>
                      <td className="p-3">{p.activeDays}</td>
                      <td className="p-3">{formatDuration(p.seconds / Math.max(1, p.activeDays))}</td>
                      <td className="p-3">{formatDuration(p.talkSeconds)}</td>
                      <td className="p-3">{p.messages}</td>
                      <td className="p-3 text-slate-400">{fmtDateTime(p.lastSeen)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="mt-8">
            <h2 className="text-lg font-semibold">Salas de reunião</h2>
            {usage.zones.length === 0 ? (
              <p className="mt-2 text-sm text-slate-400">Ninguém usou as salas privadas no período.</p>
            ) : (
              <ul className="mt-3 divide-y divide-slate-800 rounded-xl border border-slate-800 text-sm">
                {usage.zones.map((z) => (
                  <li key={z.zoneId} className="flex items-center justify-between gap-3 p-3">
                    <span className="font-medium">{usage.zoneNames.get(z.zoneId) ?? z.zoneId}</span>
                    <span className="text-slate-400">
                      {formatDuration(z.seconds)} · {z.people} {z.people === 1 ? "pessoa" : "pessoas"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      <p className="mt-8 text-xs text-slate-500">
        Contamos só presença, tempo perto de alguém (alcance de voz), tempo nas salas e número de
        mensagens — o conteúdo do chat não é guardado.{" "}
        {OFFSET_MS === -180 * 60_000 ? "Dias no horário de Brasília." : "Dias no fuso de METRICS_TZ_OFFSET_MINUTES."}
      </p>
    </main>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-slate-800 p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}
