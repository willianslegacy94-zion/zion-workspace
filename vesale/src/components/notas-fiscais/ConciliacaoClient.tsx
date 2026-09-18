"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  buscarProdutos,
  type ProdutoBusca,
} from "@/server/actions/pdv";
import {
  atualizarLoteItem,
  conciliarNotaFiscal,
  criarProdutoAPartirDoItem,
  vincularItemNota,
  type CriarProdutoAPartirDoItemInput,
  type ItemNotaDetalhe,
} from "@/server/actions/notas-fiscais";
import type { CategoriaOption } from "@/server/actions/estoque";
import { formatBRL } from "@/lib/currency";

type CriarProdutoState = { ok: boolean; message?: string };
const estadoInicialCriar: CriarProdutoState = { ok: false };

function SeletorProduto({
  item,
  onVinculado,
}: {
  item: ItemNotaDetalhe;
  onVinculado: () => void;
}) {
  const [query, setQuery] = useState("");
  const [resultados, setResultados] = useState<ProdutoBusca[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [, startTransition] = useTransition();

  async function buscar(valor: string) {
    setQuery(valor);
    if (valor.trim().length < 2) {
      setResultados([]);
      return;
    }
    setBuscando(true);
    const r = await buscarProdutos(valor);
    setResultados(r);
    setBuscando(false);
  }

  function selecionar(produto: ProdutoBusca) {
    startTransition(async () => {
      const resultado = await vincularItemNota(item.id, produto.id);
      if (resultado.ok) {
        setQuery("");
        setResultados([]);
        onVinculado();
      }
    });
  }

  return (
    <div className="relative w-56">
      <input
        value={query}
        onChange={(e) => buscar(e.target.value)}
        placeholder="Buscar produto…"
        className="w-full rounded-lg border border-vesale-border px-2.5 py-1.5 text-xs text-vesale-ink outline-none focus:border-vesale-navy"
      />
      {buscando && <p className="absolute mt-1 text-xs text-vesale-muted">Buscando…</p>}
      {resultados.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-vesale-border bg-vesale-surface shadow-md">
          {resultados.map((produto) => (
            <li
              key={produto.id}
              onClick={() => selecionar(produto)}
              className="cursor-pointer truncate px-3 py-1.5 text-xs text-vesale-ink hover:bg-vesale-navy/5"
            >
              {produto.nome}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// RF-017 (completa o Prompt 3) — cadastra o produto direto do item sem
// vínculo, reaproveitando o código de barras extraído do XML quando existir,
// em vez de exigir que o gestor já tenha cadastrado o produto antes.
function NovoProdutoForm({
  item,
  categorias,
  onCriado,
  onFechar,
}: {
  item: ItemNotaDetalhe;
  categorias: CategoriaOption[];
  onCriado: () => void;
  onFechar: () => void;
}) {
  const [state, setState] = useState<CriarProdutoState>(estadoInicialCriar);
  const [pendente, setPendente] = useState(false);

  async function handleSubmit(formData: FormData) {
    setPendente(true);
    const dados: CriarProdutoAPartirDoItemInput = {
      nome: String(formData.get("nome") ?? ""),
      categoriaId: String(formData.get("categoriaId") ?? ""),
      codigoBarras: String(formData.get("codigoBarras") ?? "") || undefined,
      medicamentoControlado: formData.get("medicamentoControlado") === "on",
    };
    const resultado = await criarProdutoAPartirDoItem(item.id, dados);
    setPendente(false);
    if (resultado.ok) {
      onCriado();
    } else {
      setState({ ok: false, message: resultado.message });
    }
  }

  return (
    <form action={handleSubmit} className="flex w-64 flex-col gap-2 rounded-lg border border-vesale-border p-2.5">
      <input
        name="nome"
        defaultValue={item.descricaoFornecedor}
        required
        className="w-full rounded-md border border-vesale-border px-2 py-1 text-xs text-vesale-ink outline-none focus:border-vesale-navy"
      />
      <select
        name="categoriaId"
        required
        defaultValue=""
        className="w-full rounded-md border border-vesale-border px-2 py-1 text-xs text-vesale-ink outline-none focus:border-vesale-navy"
      >
        <option value="" disabled>
          Categoria…
        </option>
        {categorias.map((categoria) => (
          <option key={categoria.id} value={categoria.id}>
            {categoria.nome}
          </option>
        ))}
      </select>
      <label className="flex items-center gap-1.5 text-[11px] text-vesale-ink">
        <input name="medicamentoControlado" type="checkbox" />
        Medicamento controlado
      </label>
      {state.message && <p className="text-[11px] text-vesale-red">{state.message}</p>}
      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={onFechar}
          className="flex-1 rounded-md border border-vesale-border py-1 text-[11px] text-vesale-ink hover:bg-vesale-bg"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={pendente}
          className="flex-1 rounded-md bg-vesale-navy py-1 text-[11px] font-medium text-white hover:bg-vesale-navy-dark disabled:opacity-60"
        >
          {pendente ? "Criando..." : "Criar"}
        </button>
      </div>
    </form>
  );
}

function LoteInputs({ item, onSalvo }: { item: ItemNotaDetalhe; onSalvo: (itemId: string, numeroLote: string, validade: string) => void }) {
  const [numeroLote, setNumeroLote] = useState(item.numeroLote ?? "");
  const [validade, setValidade] = useState(item.validade ?? "");
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    if (!numeroLote.trim() || !validade) return;
    setSalvando(true);
    const resultado = await atualizarLoteItem(item.id, { numeroLote, validade });
    setSalvando(false);
    if (resultado.ok) onSalvo(item.id, numeroLote, validade);
  }

  return (
    <div className="mt-1.5 flex items-center gap-1.5">
      <input
        value={numeroLote}
        onChange={(e) => setNumeroLote(e.target.value)}
        onBlur={salvar}
        placeholder="Lote"
        className="w-24 rounded-md border border-vesale-border px-2 py-1 text-[11px] text-vesale-ink outline-none focus:border-vesale-navy"
      />
      <input
        value={validade}
        onChange={(e) => setValidade(e.target.value)}
        onBlur={salvar}
        type="date"
        className="rounded-md border border-vesale-border px-2 py-1 text-[11px] text-vesale-ink outline-none focus:border-vesale-navy"
      />
      {salvando && <span className="text-[10px] text-vesale-muted">salvando…</span>}
    </div>
  );
}

export function ConciliacaoClient({
  notaFiscalId,
  itensIniciais,
  categorias,
  jaConciliada,
}: {
  notaFiscalId: string;
  itensIniciais: ItemNotaDetalhe[];
  categorias: CategoriaOption[];
  jaConciliada: boolean;
}) {
  const router = useRouter();
  const [itens, setItens] = useState(itensIniciais);
  // Vincular ou criar produto muda dados que o client não tem (nome, flag de
  // controlado) — mais simples pedir os dados frescos do servidor (via
  // router.refresh()) do que remontar tudo otimisticamente no client. Ajusta
  // durante o render, não em efeito ("Adjusting state when a prop changes").
  const [itensSincronizados, setItensSincronizados] = useState(itensIniciais);
  if (itensIniciais !== itensSincronizados) {
    setItensSincronizados(itensIniciais);
    setItens(itensIniciais);
  }
  const [criandoProdutoPara, setCriandoProdutoPara] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<{ tipo: "erro" | "sucesso"; texto: string } | null>(null);
  const [conciliando, setConciliando] = useState(false);

  const pendentes = itens.filter((item) => !item.produtoId).length;
  const pendentesLote = itens.filter(
    (item) => item.produtoMedicamentoControlado && (!item.numeroLote || !item.validade),
  ).length;

  function atualizarLote(itemId: string, numeroLote: string, validade: string) {
    setItens((atual) => atual.map((item) => (item.id === itemId ? { ...item, numeroLote, validade } : item)));
  }

  async function handleConciliar() {
    setConciliando(true);
    const resultado = await conciliarNotaFiscal(notaFiscalId);
    setConciliando(false);
    setMensagem(
      resultado.ok
        ? { tipo: "sucesso", texto: "Nota conciliada — estoque e custo atualizados." }
        : { tipo: "erro", texto: resultado.message ?? "Não foi possível conciliar." },
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-x-auto rounded-2xl border border-vesale-border bg-vesale-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-vesale-border text-left text-xs uppercase tracking-wide text-vesale-muted">
              <th className="px-4 py-2.5">Item da nota</th>
              <th className="px-4 py-2.5">Qtd.</th>
              <th className="px-4 py-2.5">Custo unit.</th>
              <th className="px-4 py-2.5">Vínculo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-vesale-border">
            {itens.map((item) => (
              <tr key={item.id}>
                <td className="px-4 py-2.5 text-vesale-ink">{item.descricaoFornecedor}</td>
                <td className="px-4 py-2.5 text-vesale-ink">{item.quantidade}</td>
                <td className="px-4 py-2.5 text-vesale-ink">{formatBRL(item.custoUnitario)}</td>
                <td className="px-4 py-2.5">
                  {jaConciliada ? (
                    <span className="text-vesale-ink">{item.produtoNome ?? "—"}</span>
                  ) : item.produtoId ? (
                    <div className="flex flex-col gap-1">
                      <span className="w-fit rounded-full bg-vesale-success/10 px-2.5 py-1 text-xs text-vesale-success">
                        {item.produtoNome}
                      </span>
                      {item.produtoMedicamentoControlado && (
                        <LoteInputs item={item} onSalvo={atualizarLote} />
                      )}
                    </div>
                  ) : criandoProdutoPara === item.id ? (
                    <NovoProdutoForm
                      item={item}
                      categorias={categorias}
                      onCriado={() => {
                        setCriandoProdutoPara(null);
                        router.refresh();
                      }}
                      onFechar={() => setCriandoProdutoPara(null)}
                    />
                  ) : (
                    <div className="flex flex-col gap-1.5">
                      <SeletorProduto item={item} onVinculado={() => router.refresh()} />
                      <button
                        type="button"
                        onClick={() => setCriandoProdutoPara(item.id)}
                        className="w-fit text-left text-[11px] text-vesale-navy underline"
                      >
                        Cadastrar novo produto
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!jaConciliada && (
        <div className="flex items-center justify-between gap-4 rounded-2xl border border-vesale-border bg-vesale-surface p-4">
          <p className="text-sm text-vesale-muted">
            {pendentes > 0
              ? `${pendentes} ${pendentes === 1 ? "item" : "itens"} ainda sem vínculo.`
              : pendentesLote > 0
                ? `${pendentesLote} ${pendentesLote === 1 ? "item controlado precisa" : "itens controlados precisam"} de lote e validade.`
                : "Todos os itens vinculados — pronta para conciliar."}
          </p>
          <button
            type="button"
            onClick={handleConciliar}
            disabled={pendentes > 0 || pendentesLote > 0 || conciliando}
            className="rounded-lg bg-vesale-navy px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-vesale-navy-dark disabled:opacity-40"
          >
            {conciliando ? "Conciliando..." : "Conciliar nota"}
          </button>
        </div>
      )}

      {mensagem && (
        <p
          className={`rounded-lg border px-3 py-2 text-sm ${
            mensagem.tipo === "erro"
              ? "border-vesale-red/30 bg-vesale-red/5 text-vesale-red"
              : "border-vesale-success/30 bg-vesale-success/5 text-vesale-success"
          }`}
        >
          {mensagem.texto}
        </p>
      )}
    </div>
  );
}
