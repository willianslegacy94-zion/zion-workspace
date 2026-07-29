import { DIAS_GRADE, DIA_SEMANA_LABEL, type LinhaAgenda } from "@/lib/agenda";

export function AgendaGrid({
  linhas,
  mostrarAlunos = false,
}: {
  linhas: LinhaAgenda[];
  mostrarAlunos?: boolean;
}) {
  if (linhas.length === 0) {
    return (
      <p className="text-sm text-foreground/50">
        Nenhum horário cadastrado ainda.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-surface-border">
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-surface px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-foreground/50">
              Modalidade
            </th>
            {DIAS_GRADE.map((dia) => (
              <th
                key={dia}
                className="border-l border-surface-border bg-surface px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wider text-foreground/50"
              >
                {DIA_SEMANA_LABEL[dia]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.map((linha) => (
            <tr key={linha.modalidade} className="border-t border-surface-border">
              <td className="sticky left-0 z-10 bg-surface-card px-3 py-3 font-medium text-foreground">
                {linha.modalidade}
              </td>
              {DIAS_GRADE.map((dia) => {
                const celulas = linha.porDia[dia] ?? [];
                return (
                  <td
                    key={dia}
                    className="border-l border-surface-border px-2 py-3 align-top"
                  >
                    {celulas.length === 0 ? (
                      <span className="block text-center text-foreground/15">
                        —
                      </span>
                    ) : (
                      <div className="flex flex-col gap-1">
                        {celulas.map((c) => (
                          <div key={c.id} className="flex flex-col gap-0.5">
                            <span
                              title={`${Math.max(c.vagas, 0)} vaga(s) de ${c.capacidadeMax}`}
                              className={`rounded-md px-2 py-1 text-center text-xs font-medium whitespace-nowrap ${
                                c.vagas <= 0
                                  ? "bg-error/10 text-error/70"
                                  : "bg-primary/10 text-primary"
                              }`}
                            >
                              {c.hora}
                            </span>
                            {mostrarAlunos && c.roster.length > 0 && (
                              <details className="text-[10px] text-foreground/50">
                                <summary className="cursor-pointer whitespace-nowrap select-none hover:text-primary">
                                  {c.roster.length} aluno(s)
                                </summary>
                                <ul className="mt-1 flex flex-col gap-0.5 pl-1">
                                  {c.roster.map((aluno) => (
                                    <li key={aluno.id} className="whitespace-nowrap">
                                      {aluno.nome}
                                      {aluno.pendente && (
                                        <span className="ml-1 text-warning">
                                          (pagamento pendente)
                                        </span>
                                      )}
                                    </li>
                                  ))}
                                </ul>
                              </details>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t border-surface-border px-3 py-2 text-xs text-foreground/40">
        Pausa para almoço: 12:00 – 13:00 (Musculação/Personal)
      </p>
    </div>
  );
}
