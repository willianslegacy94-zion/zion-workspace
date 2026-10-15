"use client";

import type { Recibo } from "@/server/actions/pdv";
import { formatBRL } from "@/lib/currency";

export function ReciboModal({
  recibo,
  formaPagamentoNome,
  onFechar,
}: {
  recibo: Recibo;
  formaPagamentoNome: string;
  onFechar: () => void;
}) {
  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4 print:relative print:bg-transparent print:p-0">
      <div className="w-full max-w-xs rounded-2xl border border-vesale-border bg-vesale-surface p-6 shadow-sm print:max-w-none print:border-none print:shadow-none">
        <div className="mb-3 flex items-center justify-between print:hidden">
          <span className="font-semibold text-vesale-ink">Venda concluída</span>
          <button
            type="button"
            onClick={onFechar}
            className="text-vesale-muted hover:text-vesale-ink"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>

        <div className="rounded-lg bg-vesale-bg p-3 font-mono text-xs text-vesale-ink print:bg-transparent">
          <p className="text-center font-bold">DROGARIA VESALE</p>
          <p className="mb-2 text-center">{new Date(recibo.data).toLocaleString("pt-BR")}</p>
          {recibo.itens.map((item, index) => (
            <div key={index} className="flex justify-between">
              <span>
                {item.quantidade}x {item.nome.slice(0, 22)}
              </span>
              <span>{formatBRL(item.precoUnitario * item.quantidade)}</span>
            </div>
          ))}
          <div className="mt-1.5 border-t border-dashed border-vesale-border pt-1.5">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>{formatBRL(recibo.subtotal)}</span>
            </div>
            {recibo.descontoValor > 0 && (
              <div className="flex justify-between">
                <span>Desconto</span>
                <span>-{formatBRL(recibo.descontoValor)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold">
              <span>Total</span>
              <span>{formatBRL(recibo.valorTotal)}</span>
            </div>
          </div>
          <p className="mt-1.5 text-center">{formaPagamentoNome}</p>
        </div>

        <button
          type="button"
          onClick={() => window.print()}
          className="mt-3 w-full rounded-lg border border-vesale-border py-2.5 text-sm font-medium text-vesale-ink transition hover:bg-vesale-bg print:hidden"
        >
          Imprimir
        </button>
      </div>
    </div>
  );
}
