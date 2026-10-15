"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { buscarNotaPorChave, criarNotaManualPorChave } from "@/server/actions/notas-fiscais";

type ItemManual = { nome: string; quantidade: string; custoUnitario: string; codigoBarras: string };

function linhaVazia(): ItemManual {
  return { nome: "", quantidade: "1", custoUnitario: "", codigoBarras: "" };
}

// Prompt 2 — bipar o QR da nota (traz a chave de acesso) abre a conciliação
// direto quando o XML já foi enviado; sem XML, a Sefaz não expõe os itens
// por essa chave, então oferece lançar manualmente (RF-014).
export function BuscarPorChaveForm() {
  const router = useRouter();
  const [chave, setChave] = useState("");
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [chaveParaLancar, setChaveParaLancar] = useState<string | null>(null);
  const [fornecedorNome, setFornecedorNome] = useState("");
  const [fornecedorCnpj, setFornecedorCnpj] = useState("");
  const [itens, setItens] = useState<ItemManual[]>([linhaVazia()]);
  const [salvando, setSalvando] = useState(false);

  async function buscar() {
    const termo = chave.trim();
    if (!termo) return;
    setBuscando(true);
    setMensagem(null);
    setChaveParaLancar(null);
    const resultado = await buscarNotaPorChave(termo);
    setBuscando(false);
    if (resultado.ok) {
      router.push(`/notas-fiscais/${resultado.notaFiscalId}`);
      return;
    }
    setMensagem(resultado.message);
    if (resultado.chaveValida && resultado.chaveNormalizada) {
      setChaveParaLancar(resultado.chaveNormalizada);
      setFornecedorNome("");
      setFornecedorCnpj("");
      setItens([linhaVazia()]);
    }
  }

  function atualizarItem(index: number, campo: keyof ItemManual, valor: string) {
    setItens((atual) => atual.map((item, i) => (i === index ? { ...item, [campo]: valor } : item)));
  }

  async function salvarLancamentoManual() {
    if (!chaveParaLancar) return;
    const validos = itens
      .filter((i) => i.nome.trim() && Number(i.quantidade) > 0)
      .map((i) => ({
        nome: i.nome.trim(),
        quantidade: Number(i.quantidade),
        custoUnitario: Number(i.custoUnitario) || 0,
        codigoBarras: i.codigoBarras.trim() || undefined,
      }));
    if (validos.length === 0) return;

    setSalvando(true);
    const resultado = await criarNotaManualPorChave({
      chave: chaveParaLancar,
      fornecedor:
        fornecedorNome.trim() && fornecedorCnpj.trim()
          ? { razaoSocial: fornecedorNome.trim(), cnpj: fornecedorCnpj.trim() }
          : undefined,
      itens: validos,
    });
    setSalvando(false);
    if (resultado.ok && resultado.notaFiscalId) {
      router.push(`/notas-fiscais/${resultado.notaFiscalId}`);
    } else {
      setMensagem(resultado.message ?? "Não foi possível salvar.");
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-vesale-border bg-vesale-surface p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-vesale-muted">
            Bipar/colar chave de acesso da nota (QR)
          </label>
          <input
            value={chave}
            onChange={(e) => setChave(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && buscar()}
            placeholder="44 dígitos da chave de acesso…"
            className="w-full rounded-lg border border-vesale-border px-3 py-2 text-sm text-vesale-ink outline-none focus:border-vesale-navy"
          />
        </div>
        <button
          type="button"
          onClick={buscar}
          disabled={buscando}
          className="rounded-lg border border-vesale-border px-4 py-2 text-sm font-medium text-vesale-ink transition hover:bg-vesale-bg disabled:opacity-60"
        >
          {buscando ? "Buscando..." : "Abrir nota"}
        </button>
      </div>

      {mensagem && <p className="text-xs text-vesale-red">{mensagem}</p>}

      {chaveParaLancar && (
        <div className="flex flex-col gap-2 rounded-lg border border-vesale-border p-3">
          <p className="text-xs text-vesale-muted">
            Sem o XML dessa nota não dá pra puxar os itens automaticamente — lance abaixo o que foi
            recebido (ou envie o XML acima, se conseguir o arquivo depois).
          </p>

          <div className="flex flex-wrap gap-1.5">
            <input
              value={fornecedorNome}
              onChange={(e) => setFornecedorNome(e.target.value)}
              placeholder="Fornecedor — razão social"
              className="min-w-[12rem] flex-1 rounded-md border border-vesale-border px-2 py-1 text-xs text-vesale-ink outline-none focus:border-vesale-navy"
            />
            <input
              value={fornecedorCnpj}
              onChange={(e) => setFornecedorCnpj(e.target.value)}
              placeholder="CNPJ do fornecedor"
              className="w-44 rounded-md border border-vesale-border px-2 py-1 text-xs text-vesale-ink outline-none focus:border-vesale-navy"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            {itens.map((item, index) => (
              <div key={index} className="flex flex-wrap items-center gap-1.5">
                <input
                  value={item.nome}
                  onChange={(e) => atualizarItem(index, "nome", e.target.value)}
                  placeholder="Nome do produto"
                  className="min-w-[10rem] flex-1 rounded-md border border-vesale-border px-2 py-1 text-xs text-vesale-ink outline-none focus:border-vesale-navy"
                />
                <input
                  value={item.quantidade}
                  onChange={(e) => atualizarItem(index, "quantidade", e.target.value)}
                  type="number"
                  min="1"
                  placeholder="Qtd."
                  className="w-16 rounded-md border border-vesale-border px-2 py-1 text-xs text-vesale-ink outline-none focus:border-vesale-navy"
                />
                <input
                  value={item.custoUnitario}
                  onChange={(e) => atualizarItem(index, "custoUnitario", e.target.value)}
                  type="number"
                  step="0.01"
                  placeholder="Custo un."
                  className="w-24 rounded-md border border-vesale-border px-2 py-1 text-xs text-vesale-ink outline-none focus:border-vesale-navy"
                />
                <input
                  value={item.codigoBarras}
                  onChange={(e) => atualizarItem(index, "codigoBarras", e.target.value)}
                  placeholder="Código de barras (opcional)"
                  className="w-40 rounded-md border border-vesale-border px-2 py-1 text-xs text-vesale-ink outline-none focus:border-vesale-navy"
                />
                <button
                  type="button"
                  onClick={() => setItens((atual) => atual.filter((_, i) => i !== index))}
                  className="text-xs text-vesale-red"
                >
                  Remover
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setItens((atual) => [...atual, linhaVazia()])}
              className="rounded-md border border-vesale-border px-3 py-1.5 text-xs font-medium text-vesale-ink hover:bg-vesale-bg"
            >
              Adicionar item
            </button>
            <button
              type="button"
              onClick={salvarLancamentoManual}
              disabled={salvando}
              className="rounded-md bg-vesale-navy px-3 py-1.5 text-xs font-semibold text-white hover:bg-vesale-navy-dark disabled:opacity-60"
            >
              {salvando ? "Salvando..." : "Salvar entrada"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
