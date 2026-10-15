"use client";

import { useActionState, useEffect, useState } from "react";
import {
  atualizarProduto,
  criarProduto,
  type CategoriaOption,
  type ProdutoEstoque,
  type ProdutoFormState,
} from "@/server/actions/estoque";
import { formatBRL } from "@/lib/currency";

const estadoInicial: ProdutoFormState = { ok: false };
const DIAS_ALERTA_VALIDADE = 30;

function diasParaVencer(validade: string): number {
  return Math.ceil((new Date(`${validade}T00:00:00`).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function ProdutoForm({
  produto,
  categorias,
  codigoBarrasInicial,
  onFechar,
}: {
  produto: ProdutoEstoque | null;
  categorias: CategoriaOption[];
  codigoBarrasInicial?: string;
  onFechar: () => void;
}) {
  const action = produto ? atualizarProduto.bind(null, produto.id) : criarProduto;
  const [state, formAction, isPending] = useActionState(action, estadoInicial);

  useEffect(() => {
    if (state.ok) onFechar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ok]);

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl border border-vesale-border bg-vesale-surface p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-vesale-ink">
          {produto ? "Editar produto" : "Novo produto"}
        </h2>

        <form action={formAction} className="flex flex-col gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-vesale-muted">
              Nome
            </label>
            <input
              name="nome"
              required
              autoFocus
              defaultValue={produto?.nome}
              className="w-full rounded-lg border border-vesale-border px-3 py-2 text-sm text-vesale-ink outline-none focus:border-vesale-navy"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-vesale-muted">
              Categoria
            </label>
            <select
              name="categoriaId"
              required
              defaultValue={produto?.categoriaId ?? ""}
              className="w-full rounded-lg border border-vesale-border px-3 py-2 text-sm text-vesale-ink outline-none focus:border-vesale-navy"
            >
              <option value="" disabled>
                Selecione…
              </option>
              {categorias.map((categoria) => (
                <option key={categoria.id} value={categoria.id}>
                  {categoria.nome}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-vesale-muted">
                Código de barras
              </label>
              <input
                name="codigoBarras"
                defaultValue={produto?.codigoBarras ?? codigoBarrasInicial ?? ""}
                className="w-full rounded-lg border border-vesale-border px-3 py-2 text-sm text-vesale-ink outline-none focus:border-vesale-navy"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-vesale-muted">
                Unidade
              </label>
              <input
                name="unidade"
                defaultValue={produto?.unidade ?? "un"}
                className="w-full rounded-lg border border-vesale-border px-3 py-2 text-sm text-vesale-ink outline-none focus:border-vesale-navy"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-vesale-muted">
                Estoque mínimo
              </label>
              <input
                name="estoqueMinimo"
                type="number"
                min="0"
                defaultValue={produto?.estoqueMinimo ?? 0}
                className="w-full rounded-lg border border-vesale-border px-3 py-2 text-sm text-vesale-ink outline-none focus:border-vesale-navy"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-vesale-muted">
                Preço de venda (R$)
              </label>
              <input
                name="precoVenda"
                type="number"
                step="0.01"
                min="0"
                defaultValue={produto?.precoVenda ?? undefined}
                className="w-full rounded-lg border border-vesale-border px-3 py-2 text-sm text-vesale-ink outline-none focus:border-vesale-navy"
              />
            </div>
          </div>

          {produto && (
            <div className="rounded-lg bg-vesale-bg px-3 py-2 text-xs text-vesale-muted">
              Custo travado (RN-009 — só muda por conciliação de nota fiscal):{" "}
              <span className="font-medium text-vesale-ink">
                {produto.custoTravado !== null ? formatBRL(produto.custoTravado) : "Custo pendente"}
              </span>
              {produto.custoTravado !== null &&
                produto.precoVenda !== null &&
                produto.precoVenda <= produto.custoTravado && (
                  <p className="mt-1 font-medium text-vesale-red">
                    Preço de venda atual está igual ou abaixo do custo travado (RF-021).
                  </p>
                )}
            </div>
          )}

          <label className="flex items-center gap-2 text-sm text-vesale-ink">
            <input
              name="medicamentoControlado"
              type="checkbox"
              defaultChecked={produto?.medicamentoControlado}
            />
            Medicamento controlado (exige receita na venda)
          </label>

          {produto && (
            <label className="flex items-center gap-2 text-sm text-vesale-ink">
              <input
                name="status"
                type="checkbox"
                value="INATIVO"
                defaultChecked={produto.status === "INATIVO"}
              />
              Produto inativo
            </label>
          )}

          {state.message && (
            <p className="rounded-lg border border-vesale-red/30 bg-vesale-red/5 px-3 py-2 text-xs text-vesale-red">
              {state.message}
            </p>
          )}

          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={onFechar}
              className="flex-1 rounded-lg border border-vesale-border py-2.5 text-sm font-medium text-vesale-ink transition hover:bg-vesale-bg"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 rounded-lg bg-vesale-navy py-2.5 text-sm font-medium text-white transition hover:bg-vesale-navy-dark disabled:opacity-60"
            >
              {isPending ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function EstoqueClient({
  produtosIniciais,
  categorias,
  papel,
}: {
  produtosIniciais: ProdutoEstoque[];
  categorias: CategoriaOption[];
  papel: "GESTOR" | "OPERADOR_CAIXA";
}) {
  const somenteLeitura = papel !== "GESTOR";
  const [codigoLeitor, setCodigoLeitor] = useState("");
  const [produtoEmEdicao, setProdutoEmEdicao] = useState<ProdutoEstoque | null>(null);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [codigoParaNovo, setCodigoParaNovo] = useState<string | undefined>(undefined);

  const produtos = produtosIniciais;

  // "Modo leitor" (Prompt 2) — bipar código já cadastrado abre a edição dele;
  // código novo abre o cadastro já com o código preenchido.
  function handleLeitorKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const termo = codigoLeitor.trim();
    if (!termo) return;

    const existente = produtos.find((p) => p.codigoBarras === termo);
    if (existente) {
      setProdutoEmEdicao(existente);
      setCodigoParaNovo(undefined);
    } else {
      setProdutoEmEdicao(null);
      setCodigoParaNovo(termo);
    }
    setMostrarForm(true);
    setCodigoLeitor("");
  }

  function abrirNovo() {
    setProdutoEmEdicao(null);
    setCodigoParaNovo(undefined);
    setMostrarForm(true);
  }

  function abrirEdicao(produto: ProdutoEstoque) {
    setProdutoEmEdicao(produto);
    setCodigoParaNovo(undefined);
    setMostrarForm(true);
  }

  return (
    <div className="mx-auto flex max-w-[1500px] flex-col gap-4 p-4 md:p-7">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-vesale-ink">Estoque</h1>
        {!somenteLeitura && (
          <button
            type="button"
            onClick={abrirNovo}
            className="rounded-lg bg-vesale-navy px-4 py-2 text-sm font-semibold text-white transition hover:bg-vesale-navy-dark"
          >
            Novo produto
          </button>
        )}
      </div>

      {!somenteLeitura && (
        <input
          value={codigoLeitor}
          onChange={(e) => setCodigoLeitor(e.target.value)}
          onKeyDown={handleLeitorKeyDown}
          placeholder="Leia o código de barras — já cadastrado abre a edição, novo abre o cadastro…"
          className="w-full rounded-xl border border-vesale-border bg-vesale-surface px-4 py-3 text-sm text-vesale-ink outline-none focus:border-vesale-navy"
        />
      )}

      <div className="overflow-x-auto rounded-2xl border border-vesale-border bg-vesale-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-vesale-border text-left text-xs uppercase tracking-wide text-vesale-muted">
              <th className="px-4 py-2.5">Produto</th>
              <th className="px-4 py-2.5">Categoria</th>
              <th className="px-4 py-2.5">Estoque</th>
              <th className="px-4 py-2.5">Preço</th>
              <th className="px-4 py-2.5">Validade mais próxima</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-vesale-border">
            {produtos.map((produto) => {
              const estoqueBaixo = produto.quantidadeEstoque <= produto.estoqueMinimo;
              const dias = produto.validadeMaisProxima ? diasParaVencer(produto.validadeMaisProxima) : null;
              const vencendo = dias !== null && dias <= DIAS_ALERTA_VALIDADE;

              return (
                <tr
                  key={produto.id}
                  onClick={somenteLeitura ? undefined : () => abrirEdicao(produto)}
                  className={`${somenteLeitura ? "" : "cursor-pointer hover:bg-vesale-bg"} ${produto.status === "INATIVO" ? "opacity-50" : ""}`}
                >
                  <td className="px-4 py-2.5">
                    <p className="flex items-center gap-2 text-vesale-ink">
                      {produto.nome}
                      {produto.medicamentoControlado && (
                        <span className="rounded-full bg-vesale-red/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-vesale-red">
                          Controlado
                        </span>
                      )}
                    </p>
                    {produto.codigoBarras && (
                      <p className="text-xs text-vesale-muted">{produto.codigoBarras}</p>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-vesale-ink">{produto.categoriaNome}</td>
                  <td className="px-4 py-2.5">
                    <span
                      className={
                        estoqueBaixo
                          ? "rounded-full bg-vesale-warning/10 px-2 py-0.5 text-xs font-medium text-vesale-warning"
                          : "text-vesale-ink"
                      }
                    >
                      {produto.quantidadeEstoque} {produto.unidade}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    {produto.precoVenda === null ? (
                      <span className="text-vesale-ink">—</span>
                    ) : produto.custoTravado !== null && produto.precoVenda <= produto.custoTravado ? (
                      <span className="rounded-full bg-vesale-red/10 px-2 py-0.5 text-xs font-medium text-vesale-red">
                        {formatBRL(produto.precoVenda)}
                      </span>
                    ) : (
                      <span className="text-vesale-ink">{formatBRL(produto.precoVenda)}</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    {produto.validadeMaisProxima ? (
                      <span
                        className={
                          vencendo
                            ? "rounded-full bg-vesale-red/10 px-2 py-0.5 text-xs font-medium text-vesale-red"
                            : "text-vesale-ink"
                        }
                      >
                        {new Date(`${produto.validadeMaisProxima}T00:00:00`).toLocaleDateString("pt-BR")}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {mostrarForm && (
        <ProdutoForm
          produto={produtoEmEdicao}
          categorias={categorias}
          codigoBarrasInicial={codigoParaNovo}
          onFechar={() => setMostrarForm(false)}
        />
      )}
    </div>
  );
}
