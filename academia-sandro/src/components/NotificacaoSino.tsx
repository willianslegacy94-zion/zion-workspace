"use client";

import { useState } from "react";
import Link from "next/link";
import { Bell, MessageCircle } from "lucide-react";
import { mensagemCobranca, montarLinkWhatsapp } from "@/lib/whatsapp";

export type AlertaVencimento = {
  id: string;
  nome: string;
  telefone: string | null;
  dias: number;
};

export function NotificacaoSino({
  vencimentos,
  preCadastrosPendentes,
}: {
  vencimentos: AlertaVencimento[];
  preCadastrosPendentes: number;
}) {
  const [aberto, setAberto] = useState(false);
  const total = vencimentos.length + preCadastrosPendentes;

  return (
    <div className="relative">
      <button
        onClick={() => setAberto((v) => !v)}
        aria-label="Notificações"
        className="relative rounded-lg p-2 text-foreground/60 transition-colors hover:bg-surface-hover hover:text-primary"
      >
        <Bell size={18} />
        {total > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-error px-1 text-[10px] font-semibold text-white">
            {total}
          </span>
        )}
      </button>

      {aberto && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setAberto(false)}
          />
          <div className="absolute right-0 z-50 mt-2 w-80 rounded-lg border border-surface-border bg-surface-card shadow-lg">
            <div className="max-h-96 overflow-y-auto p-3">
              <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-wider text-foreground/40">
                Matrículas vencendo
              </p>
              {vencimentos.length === 0 && (
                <p className="px-1 pb-3 text-sm text-foreground/40">
                  Nenhuma matrícula vencendo.
                </p>
              )}
              {vencimentos.map((a) => (
                <div
                  key={a.id}
                  className="mb-2 flex items-center justify-between gap-2 rounded-lg border border-surface-border px-3 py-2"
                >
                  <div>
                    <p className="text-sm text-foreground">{a.nome}</p>
                    <p
                      className={`text-xs ${a.dias < 0 ? "text-error" : "text-warning"}`}
                    >
                      {a.dias < 0
                        ? "Venceu"
                        : a.dias === 0
                          ? "Vence hoje"
                          : `Vence em ${a.dias}d`}
                    </p>
                  </div>
                  {a.telefone && (
                    <a
                      href={montarLinkWhatsapp(
                        a.telefone,
                        mensagemCobranca(a.nome, a.dias),
                      )}
                      target="_blank"
                      rel="noreferrer"
                      title="Cobrar via WhatsApp"
                      className="shrink-0 rounded-lg p-1.5 text-success hover:bg-success/10"
                    >
                      <MessageCircle size={16} />
                    </a>
                  )}
                </div>
              ))}

              {preCadastrosPendentes > 0 && (
                <>
                  <p className="mb-2 mt-3 px-1 text-[10px] font-semibold uppercase tracking-wider text-foreground/40">
                    Pré-cadastros pendentes
                  </p>
                  <Link
                    href="/pre-cadastros"
                    onClick={() => setAberto(false)}
                    className="block rounded-lg border border-primary/20 bg-primary/10 px-3 py-2 text-sm text-primary hover:bg-primary/20"
                  >
                    {preCadastrosPendentes} pré-cadastro(s) aguardando revisão
                  </Link>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
