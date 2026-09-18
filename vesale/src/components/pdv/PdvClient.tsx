"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  buscarProdutos,
  finalizarVenda,
  type FormaPagamentoOption,
  type ProdutoBusca,
  type Recibo,
} from "@/server/actions/pdv";
import { formatBRL } from "@/lib/currency";
import { FecharCaixaForm } from "@/components/pdv/FecharCaixaForm";
import { ReciboModal } from "@/components/pdv/ReciboModal";

type ItemCarrinho = {
  produtoId: string;
  nome: string;
  precoVenda: number | null;
  quantidade: number;
  medicamentoControlado: boolean;
  receitaConfirmada: boolean;
};

type Mensagem = { tipo: "erro" | "sucesso"; texto: string };

export function PdvClient({
  sessaoCaixaId,
  valorAbertura,
  formasPagamento,
}: {
  sessaoCaixaId: string;
  valorAbertura: number;
  formasPagamento: FormaPagamentoOption[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [resultados, setResultados] = useState<ProdutoBusca[]>([]);
  const [indiceDestacado, setIndiceDestacado] = useState(0);
  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([]);
  const [formaPagamentoId, setFormaPagamentoId] = useState<string | null>(
    formasPagamento[0]?.id ?? null,
  );
  const [descontoTexto, setDescontoTexto] = useState("");
  const [mensagem, setMensagem] = useState<Mensagem | null>(null);
  const [finalizando, setFinalizando] = useState(false);
  const [mostrarFecharCaixa, setMostrarFecharCaixa] = useState(false);
  const [reciboAtual, setReciboAtual] = useState<Recibo | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const carrinhoRef = useRef(carrinho);
  const formaPagamentoRef = useRef(formaPagamentoId);
  const descontoRef = useRef(descontoTexto);

  // Mantém os refs frescos pro atalho F2 (listener registrado uma única vez,
  // ver efeito abaixo) sem reatribuir ref durante o render.
  useEffect(() => {
    carrinhoRef.current = carrinho;
    formaPagamentoRef.current = formaPagamentoId;
    descontoRef.current = descontoTexto;
  });

  // Busca ao digitar (RF-009) — código de barras completo + Enter também
  // dispara busca imediata no handleKeyDown, sem esperar o debounce. Só
  // dispara o fetch com 2+ caracteres; abaixo disso resultadosVisiveis já
  // mascara pra vazio sem precisar limpar o state aqui.
  useEffect(() => {
    if (query.trim().length < 2) return;
    const handle = setTimeout(() => {
      buscarProdutos(query).then((r) => {
        setResultados(r);
        setIndiceDestacado(0);
      });
    }, 150);
    return () => clearTimeout(handle);
  }, [query]);

  const resultadosVisiveis = query.trim().length < 2 ? [] : resultados;

  function adicionarAoCarrinho(produto: ProdutoBusca) {
    if (produto.quantidadeEstoque <= 0) {
      setMensagem({ tipo: "erro", texto: `"${produto.nome}" sem estoque disponível.` });
      return;
    }
    setCarrinho((atual) => {
      const existente = atual.find((i) => i.produtoId === produto.id);
      if (existente) {
        return atual.map((i) =>
          i.produtoId === produto.id ? { ...i, quantidade: i.quantidade + 1 } : i,
        );
      }
      return [
        ...atual,
        {
          produtoId: produto.id,
          nome: produto.nome,
          precoVenda: produto.precoVenda,
          quantidade: 1,
          medicamentoControlado: produto.medicamentoControlado,
          receitaConfirmada: false,
        },
      ];
    });
    setQuery("");
    setResultados([]);
    setMensagem(null);
    inputRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (resultadosVisiveis.length > 0) {
        adicionarAoCarrinho(resultadosVisiveis[indiceDestacado]);
        return;
      }
      const termo = query.trim();
      if (!termo) return;
      buscarProdutos(termo).then((r) => {
        if (r.length === 1) {
          adicionarAoCarrinho(r[0]);
        } else if (r.length > 1) {
          setResultados(r);
          setIndiceDestacado(0);
        } else {
          setMensagem({ tipo: "erro", texto: `Produto não encontrado para "${termo}".` });
        }
      });
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setIndiceDestacado((i) => Math.min(i + 1, Math.max(resultadosVisiveis.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndiceDestacado((i) => Math.max(i - 1, 0));
    } else if (e.key === "Escape") {
      setQuery("");
      setResultados([]);
    }
  }

  function alterarQuantidade(produtoId: string, delta: number) {
    setCarrinho((atual) =>
      atual
        .map((i) => (i.produtoId === produtoId ? { ...i, quantidade: i.quantidade + delta } : i))
        .filter((i) => i.quantidade > 0),
    );
  }

  function removerItem(produtoId: string) {
    setCarrinho((atual) => atual.filter((i) => i.produtoId !== produtoId));
  }

  // RN-013 — confirmação de receita por item de medicamento controlado,
  // obrigatória antes de finalizar (checagem final em handleFinalizar).
  function alternarReceita(produtoId: string) {
    setCarrinho((atual) =>
      atual.map((i) =>
        i.produtoId === produtoId ? { ...i, receitaConfirmada: !i.receitaConfirmada } : i,
      ),
    );
  }

  function cancelarVenda() {
    // RF-012 — cancelar antes de finalizar nunca grava nada no banco: o
    // carrinho só existe no client até a confirmação (ver comentário em
    // server/actions/pdv.ts#finalizarVenda).
    setCarrinho([]);
    setFormaPagamentoId(formasPagamento[0]?.id ?? null);
    setDescontoTexto("");
    setMensagem(null);
    inputRef.current?.focus();
  }

  const subtotal = carrinho.reduce((acc, i) => acc + (i.precoVenda ?? 0) * i.quantidade, 0);
  const descontoValor = Math.min(Math.max(Number(descontoTexto) || 0, 0), subtotal);
  const total = subtotal - descontoValor;
  const receitaPendente = carrinho.some((i) => i.medicamentoControlado && !i.receitaConfirmada);

  async function handleFinalizar() {
    if (carrinhoRef.current.length === 0) {
      setMensagem({ tipo: "erro", texto: "Carrinho vazio." });
      return;
    }
    if (!formaPagamentoRef.current) {
      setMensagem({ tipo: "erro", texto: "Selecione a forma de pagamento." });
      return;
    }
    if (receitaPendente) {
      setMensagem({ tipo: "erro", texto: "Confirme a receita dos itens controlados antes de finalizar." });
      return;
    }

    setFinalizando(true);
    const resultado = await finalizarVenda({
      sessaoCaixaId,
      formaPagamentoId: formaPagamentoRef.current,
      descontoValor,
      itens: carrinhoRef.current.map((i) => ({
        produtoId: i.produtoId,
        quantidade: i.quantidade,
        receitaConfirmada: i.receitaConfirmada,
      })),
    });
    setFinalizando(false);

    if (resultado.ok) {
      setMensagem({
        tipo: "sucesso",
        texto: `Venda finalizada — total ${formatBRL(resultado.recibo.valorTotal)}.`,
      });
      setReciboAtual(resultado.recibo);
      setCarrinho([]);
      setDescontoTexto("");
      inputRef.current?.focus();
    } else {
      setMensagem({ tipo: "erro", texto: resultado.message });
    }
  }

  // Atalho F2 — finalizar venda sem sair do teclado (RN-006).
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "F2") {
        e.preventDefault();
        handleFinalizar();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mx-auto flex max-w-[1500px] flex-col gap-4 p-4 md:p-7">
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={() => setMostrarFecharCaixa(true)}
          className="rounded-lg border border-vesale-border px-3 py-1.5 text-xs font-medium text-vesale-ink transition hover:bg-vesale-bg"
        >
          Fechar caixa
        </button>
      </div>

      <div className="relative">
        <input
          ref={inputRef}
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Leia o código de barras ou digite o nome do produto…"
          className="w-full rounded-xl border border-vesale-border bg-vesale-surface px-4 py-3.5 text-lg text-vesale-ink outline-none focus:border-vesale-navy"
        />

        {resultadosVisiveis.length > 0 && (
          <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-vesale-border bg-vesale-surface shadow-md">
            {resultadosVisiveis.map((produto, index) => (
              <li
                key={produto.id}
                onMouseEnter={() => setIndiceDestacado(index)}
                onClick={() => adicionarAoCarrinho(produto)}
                className={`flex cursor-pointer items-center justify-between px-4 py-2.5 text-sm ${
                  index === indiceDestacado ? "bg-vesale-navy/5" : ""
                } ${produto.quantidadeEstoque <= 0 ? "opacity-50" : ""}`}
              >
                <span className="flex items-center gap-2 text-vesale-ink">
                  {produto.nome}
                  {produto.medicamentoControlado && (
                    <span className="rounded-full bg-vesale-red/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-vesale-red">
                      Controlado
                    </span>
                  )}
                </span>
                <span className="flex items-center gap-3 text-vesale-muted">
                  <span>{produto.quantidadeEstoque <= 0 ? "sem estoque" : `${produto.quantidadeEstoque} un`}</span>
                  <span className="font-medium text-vesale-navy">
                    {produto.precoVenda !== null ? formatBRL(produto.precoVenda) : "sem preço"}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

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

      <div className="rounded-2xl border border-vesale-border bg-vesale-surface">
        {carrinho.length === 0 ? (
          <p className="p-8 text-center text-sm text-vesale-muted">
            Nenhum item na venda ainda. Leia um código de barras para começar.
          </p>
        ) : (
          <ul className="divide-y divide-vesale-border">
            {carrinho.map((item) => (
              <li key={item.produtoId} className="flex flex-col gap-2 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 truncate text-sm font-medium text-vesale-ink">
                      {item.nome}
                      {item.medicamentoControlado && (
                        <span className="rounded-full bg-vesale-red/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-vesale-red">
                          Controlado
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-vesale-muted">
                      {item.precoVenda !== null ? formatBRL(item.precoVenda) : "sem preço"} / un
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => alterarQuantidade(item.produtoId, -1)}
                      className="h-7 w-7 rounded-md border border-vesale-border text-vesale-ink hover:bg-vesale-bg"
                      aria-label="Diminuir quantidade"
                    >
                      −
                    </button>
                    <span className="w-6 text-center text-sm text-vesale-ink">{item.quantidade}</span>
                    <button
                      type="button"
                      onClick={() => alterarQuantidade(item.produtoId, 1)}
                      className="h-7 w-7 rounded-md border border-vesale-border text-vesale-ink hover:bg-vesale-bg"
                      aria-label="Aumentar quantidade"
                    >
                      +
                    </button>
                  </div>

                  <p className="w-24 text-right text-sm font-semibold text-vesale-ink">
                    {formatBRL((item.precoVenda ?? 0) * item.quantidade)}
                  </p>

                  <button
                    type="button"
                    onClick={() => removerItem(item.produtoId)}
                    className="text-vesale-red/70 hover:text-vesale-red"
                    aria-label={`Remover ${item.nome}`}
                  >
                    ✕
                  </button>
                </div>

                {item.medicamentoControlado && (
                  <label className="flex items-center gap-2 text-xs text-vesale-ink">
                    <input
                      type="checkbox"
                      checked={item.receitaConfirmada}
                      onChange={() => alternarReceita(item.produtoId)}
                    />
                    Receita apresentada e conferida
                  </label>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-2xl border border-vesale-border bg-vesale-surface p-4">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-vesale-muted">
          Forma de pagamento
        </p>
        <div className="flex flex-wrap gap-2">
          {formasPagamento.map((forma) => (
            <button
              key={forma.id}
              type="button"
              onClick={() => setFormaPagamentoId(forma.id)}
              className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                formaPagamentoId === forma.id
                  ? "border-vesale-navy bg-vesale-navy text-white"
                  : "border-vesale-border text-vesale-ink hover:bg-vesale-bg"
              }`}
            >
              {forma.nome}
            </button>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between gap-4">
          <label className="text-xs font-medium uppercase tracking-wide text-vesale-muted">
            Desconto (R$)
          </label>
          <input
            value={descontoTexto}
            onChange={(e) => setDescontoTexto(e.target.value)}
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            placeholder="0,00"
            className="w-32 rounded-lg border border-vesale-border px-3 py-1.5 text-right text-sm text-vesale-ink outline-none focus:border-vesale-navy"
          />
        </div>
      </div>

      <div className="sticky bottom-0 flex items-center justify-between gap-4 rounded-2xl border border-vesale-border bg-vesale-surface p-4 shadow-sm">
        <div>
          <p className="text-xs uppercase tracking-wide text-vesale-muted">Total</p>
          {descontoValor > 0 && (
            <p className="text-xs text-vesale-muted line-through">{formatBRL(subtotal)}</p>
          )}
          <p className="text-2xl font-bold text-vesale-ink">{formatBRL(total)}</p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={cancelarVenda}
            disabled={carrinho.length === 0 || finalizando}
            className="rounded-lg border border-vesale-red/40 px-4 py-2.5 text-sm font-medium text-vesale-red transition hover:bg-vesale-red/5 disabled:opacity-40"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleFinalizar}
            disabled={finalizando}
            className="rounded-lg bg-vesale-navy px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-vesale-navy-dark disabled:opacity-60"
          >
            {finalizando ? "Finalizando..." : "Finalizar Venda (F2)"}
          </button>
        </div>
      </div>

      {mostrarFecharCaixa && (
        <FecharCaixaForm
          sessaoCaixaId={sessaoCaixaId}
          valorAbertura={valorAbertura}
          onCancelar={() => setMostrarFecharCaixa(false)}
          onFechado={() => {
            setMostrarFecharCaixa(false);
            router.refresh();
          }}
        />
      )}

      {reciboAtual && (
        <ReciboModal
          recibo={reciboAtual}
          formaPagamentoNome={
            formasPagamento.find((f) => f.id === formaPagamentoId)?.nome ?? "—"
          }
          onFechar={() => setReciboAtual(null)}
        />
      )}
    </div>
  );
}
