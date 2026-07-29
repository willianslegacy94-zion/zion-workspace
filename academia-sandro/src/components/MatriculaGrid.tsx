import {
  DIAS_GRADE,
  DIA_SEMANA_LABEL,
  type LinhaMatricula,
} from "@/lib/agenda";
import { MatricularAcaoCelula } from "@/components/MatricularAcaoCelula";

export function MatriculaGrid({
  linhas,
  precos,
  matricularAction,
  cancelarAction,
}: {
  linhas: LinhaMatricula[];
  precos: Record<string, number>;
  matricularAction: (agendaAulaId: string, formaPagamento: string) => Promise<void>;
  cancelarAction: (agendaAulaId: string) => Promise<void>;
}) {
  if (linhas.length === 0) {
    return (
      <p className="text-sm text-foreground/50">
        Nenhuma outra modalidade disponível pra matrícula no momento.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-surface-border">
      <table className="w-full min-w-[820px] border-collapse text-sm">
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
                      <div className="flex flex-col gap-1.5">
                        {celulas.map((c) => (
                          <div
                            key={c.id}
                            className="flex flex-col items-center gap-1 rounded-md border border-surface-border px-1.5 py-1.5"
                          >
                            <span className="text-xs font-medium text-foreground">
                              {c.hora}
                            </span>
                            <span className="text-[10px] text-foreground/40">
                              {Math.max(c.vagas, 0)}/{c.capacidadeMax} vagas
                            </span>
                            <MatricularAcaoCelula
                              celula={c}
                              modalidade={linha.modalidade}
                              dia={dia}
                              preco={precos[linha.modalidade] ?? 0}
                              matricularAction={matricularAction}
                              cancelarAction={cancelarAction}
                            />
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
    </div>
  );
}
