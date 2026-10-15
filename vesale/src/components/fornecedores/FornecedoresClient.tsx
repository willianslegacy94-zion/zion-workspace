"use client";

import { useActionState, useEffect, useState } from "react";
import {
  atualizarFornecedor,
  criarFornecedor,
  type FornecedorFormState,
  type FornecedorResumo,
} from "@/server/actions/fornecedores";
import { formatBRL } from "@/lib/currency";

const estadoInicial: FornecedorFormState = { ok: false };

function formatarCnpj(cnpj: string): string {
  if (cnpj.length !== 14) return cnpj;
  return cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

function FornecedorForm({
  fornecedor,
  onFechar,
}: {
  fornecedor: FornecedorResumo | null;
  onFechar: () => void;
}) {
  const action = fornecedor ? atualizarFornecedor.bind(null, fornecedor.id) : criarFornecedor;
  const [state, formAction, isPending] = useActionState(action, estadoInicial);

  useEffect(() => {
    if (state.ok) onFechar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ok]);

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-vesale-border bg-vesale-surface p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-vesale-ink">
          {fornecedor ? "Editar fornecedor" : "Novo fornecedor"}
        </h2>

        <form action={formAction} className="flex flex-col gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-vesale-muted">
              Razão social
            </label>
            <input
              name="razaoSocial"
              required
              autoFocus
              defaultValue={fornecedor?.razaoSocial}
              className="w-full rounded-lg border border-vesale-border px-3 py-2 text-sm text-vesale-ink outline-none focus:border-vesale-navy"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-vesale-muted">
              CNPJ
            </label>
            <input
              name="cnpj"
              required
              placeholder="00.000.000/0000-00"
              defaultValue={fornecedor ? formatarCnpj(fornecedor.cnpj) : ""}
              className="w-full rounded-lg border border-vesale-border px-3 py-2 text-sm text-vesale-ink outline-none focus:border-vesale-navy"
            />
          </div>

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

export function FornecedoresClient({ fornecedoresIniciais }: { fornecedoresIniciais: FornecedorResumo[] }) {
  const [query, setQuery] = useState("");
  const [editando, setEditando] = useState<FornecedorResumo | null>(null);
  const [mostrarForm, setMostrarForm] = useState(false);

  const filtrados = fornecedoresIniciais.filter(
    (f) =>
      !query ||
      f.razaoSocial.toLowerCase().includes(query.toLowerCase()) ||
      f.cnpj.includes(query.replace(/\D/g, "")),
  );

  return (
    <div className="mx-auto flex max-w-[1500px] flex-col gap-4 p-4 md:p-7">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-vesale-ink">Fornecedores</h1>
        <button
          type="button"
          onClick={() => {
            setEditando(null);
            setMostrarForm(true);
          }}
          className="rounded-lg bg-vesale-navy px-4 py-2 text-sm font-semibold text-white transition hover:bg-vesale-navy-dark"
        >
          Novo fornecedor
        </button>
      </div>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar por razão social ou CNPJ…"
        className="w-full rounded-xl border border-vesale-border bg-vesale-surface px-4 py-2.5 text-sm text-vesale-ink outline-none focus:border-vesale-navy"
      />

      <div className="overflow-x-auto rounded-2xl border border-vesale-border bg-vesale-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-vesale-border text-left text-xs uppercase tracking-wide text-vesale-muted">
              <th className="px-4 py-2.5">Razão social</th>
              <th className="px-4 py-2.5">CNPJ</th>
              <th className="px-4 py-2.5">Pedidos</th>
              <th className="px-4 py-2.5">Valor total</th>
              <th className="px-4 py-2.5">Último pedido</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-vesale-border">
            {filtrados.map((f) => (
              <tr
                key={f.id}
                onClick={() => {
                  setEditando(f);
                  setMostrarForm(true);
                }}
                className="cursor-pointer hover:bg-vesale-bg"
              >
                <td className="px-4 py-2.5 text-vesale-ink">{f.razaoSocial}</td>
                <td className="px-4 py-2.5 text-vesale-ink">{formatarCnpj(f.cnpj)}</td>
                <td className="px-4 py-2.5 text-vesale-ink">{f.totalPedidos}</td>
                <td className="px-4 py-2.5 font-medium text-vesale-ink">{formatBRL(f.valorTotalPedidos)}</td>
                <td className="px-4 py-2.5 text-vesale-ink">
                  {f.ultimoPedidoEm ? new Date(f.ultimoPedidoEm).toLocaleDateString("pt-BR") : "—"}
                </td>
                <td className="px-4 py-2.5 text-right text-xs text-vesale-navy">editar</td>
              </tr>
            ))}
            {filtrados.length === 0 && (
              <tr>
                <td className="px-4 py-8 text-center text-sm text-vesale-muted" colSpan={6}>
                  Nenhum fornecedor encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {mostrarForm && (
        <FornecedorForm fornecedor={editando} onFechar={() => setMostrarForm(false)} />
      )}
    </div>
  );
}
