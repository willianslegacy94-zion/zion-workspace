"use client";

import { useState } from "react";
import { criarPacote } from "@/app/(app)/configuracoes/precos-actions";

type AlunoOpcao = { id: string; nome: string; modalidade: string };
type TipoPacote = "FAMILIA" | "COMBO_MODALIDADES";

export function CriarPacoteForm({
  alunos,
  tipoFixo,
}: {
  alunos: AlunoOpcao[];
  // Quando informado, trava o tipo (usado pelos blocos separados de
  // Configurações → Preços: "Pacotes Combo" e "Pacote Família") — sem essa
  // trava o form deixaria escolher o tipo livremente, o que não faz sentido
  // mais agora que os dois têm fluxos de criação bem diferentes.
  tipoFixo?: TipoPacote;
}) {
  const [tipo, setTipo] = useState<TipoPacote>(tipoFixo ?? "FAMILIA");
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [titular, setTitular] = useState("");

  function toggleAluno(id: string) {
    setSelecionados((atual) => {
      const novo = atual.includes(id)
        ? atual.filter((a) => a !== id)
        : [...atual, id];
      setTitular((titularAtual) =>
        novo.includes(titularAtual) ? titularAtual : (novo[0] ?? ""),
      );
      return novo;
    });
  }

  return (
    <form action={criarPacote} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          Nome do pacote
          <input
            name="nome"
            required
            placeholder={tipo === "FAMILIA" ? "Ex: Família Silva" : "Ex: Combo Capoeira + Boxe"}
            className="rounded-md border border-foreground/20 bg-transparent px-3 py-2 outline-none focus:border-primary"
          />
        </label>
        {tipoFixo ? (
          <input type="hidden" name="tipo" value={tipoFixo} />
        ) : (
          <label className="flex flex-col gap-1 text-sm">
            Tipo
            <select
              name="tipo"
              value={tipo}
              onChange={(e) => setTipo(e.target.value as TipoPacote)}
              className="rounded-md border border-foreground/20 bg-background px-3 py-2 outline-none focus:border-primary"
            >
              <option value="FAMILIA">Família (vários alunos)</option>
              <option value="COMBO_MODALIDADES">
                Combo modalidades (1 aluno, 2+ lutas)
              </option>
            </select>
          </label>
        )}
      </div>

      {tipo === "FAMILIA" ? (
        <div className="flex flex-col gap-2">
          <p className="text-xs uppercase tracking-wider text-foreground/50">
            Integrantes
          </p>
          {alunos.length === 0 && (
            <p className="text-sm text-foreground/50">
              Todos os alunos já estão em algum pacote.
            </p>
          )}
          {alunos.map((aluno) => {
            const marcado = selecionados.includes(aluno.id);
            return (
              <div
                key={aluno.id}
                className="flex flex-wrap items-center gap-3 rounded-md border border-foreground/10 px-3 py-2"
              >
                <label className="flex flex-1 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name={`incluir_${aluno.id}`}
                    checked={marcado}
                    onChange={() => toggleAluno(aluno.id)}
                    className="h-4 w-4 accent-primary"
                  />
                  {aluno.nome}{" "}
                  <span className="text-foreground/40">
                    ({aluno.modalidade})
                  </span>
                </label>
                {marcado && (
                  <>
                    <label className="flex items-center gap-1 text-xs text-foreground/60">
                      Desconto %
                      <input
                        name={`desconto_${aluno.id}`}
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        defaultValue={0}
                        className="w-20 rounded-md border border-foreground/20 bg-transparent px-2 py-1 outline-none focus:border-primary"
                      />
                    </label>
                    <label className="flex items-center gap-1 text-xs text-foreground/60">
                      <input
                        type="radio"
                        name="titular"
                        value={aluno.id}
                        checked={titular === aluno.id}
                        onChange={() => setTitular(aluno.id)}
                        className="h-3.5 w-3.5 accent-primary"
                      />
                      Titular (login)
                    </label>
                  </>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            Aluno (opcional)
            <select
              name="alunoId"
              defaultValue=""
              className="rounded-md border border-foreground/20 bg-background px-3 py-2 outline-none focus:border-primary"
            >
              <option value="">Nenhum — criar só o modelo do combo</option>
              {alunos.map((aluno) => (
                <option key={aluno.id} value={aluno.id}>
                  {aluno.nome} ({aluno.modalidade})
                </option>
              ))}
            </select>
            <span className="text-xs text-foreground/40">
              Deixe em branco pra criar um combo-catálogo que o próprio aluno
              escolhe na hora de se matricular.
            </span>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Desconto no valor total (%)
            <input
              name="desconto"
              type="number"
              step="0.01"
              min="0"
              max="100"
              defaultValue={0}
              className="rounded-md border border-foreground/20 bg-transparent px-3 py-2 outline-none focus:border-primary"
            />
          </label>
        </div>
      )}

      <button
        type="submit"
        className="self-start rounded-md bg-primary px-5 py-2 text-sm font-medium text-background transition-colors hover:bg-secondary"
      >
        Criar pacote
      </button>
    </form>
  );
}
