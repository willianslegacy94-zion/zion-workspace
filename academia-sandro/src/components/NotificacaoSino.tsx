"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Bell, Check, MessageCircle } from "lucide-react";
import { mensagemCobranca, montarLinkWhatsapp } from "@/lib/whatsapp";
import type { Alertas } from "@/lib/alertas";

function PontoNovo({ novo }: { novo: boolean }) {
  if (!novo) return null;
  return (
    <span
      title="Novo desde a última vez que você marcou como lido"
      className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
    />
  );
}

export function NotificacaoSino({
  alertas,
  marcarAlertasComoLidos,
}: {
  alertas: Alertas;
  marcarAlertasComoLidos: () => Promise<void>;
}) {
  const [aberto, setAberto] = useState(false);
  const [pending, startTransition] = useTransition();

  function marcarComoLido() {
    startTransition(async () => {
      await marcarAlertasComoLidos();
    });
  }

  return (
    <div className="relative">
      <button
        onClick={() => setAberto((v) => !v)}
        aria-label="Notificações"
        className="relative rounded-lg p-2 text-foreground/60 transition-colors hover:bg-surface-hover hover:text-primary"
      >
        <Bell size={18} />
        {alertas.naoLidos > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-error px-1 text-[10px] font-semibold text-white">
            {alertas.naoLidos}
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
            <div className="flex items-center justify-between border-b border-surface-border px-3 py-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-foreground/50">
                Notificações
              </span>
              {alertas.naoLidos > 0 && (
                <button
                  onClick={marcarComoLido}
                  disabled={pending}
                  className="flex items-center gap-1 text-xs font-medium text-primary hover:underline disabled:opacity-50"
                >
                  <Check size={12} />
                  Marcar como lida
                </button>
              )}
            </div>

            <div className="max-h-96 overflow-y-auto p-3">
              <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-wider text-foreground/40">
                Alunos inadimplentes
              </p>
              {alertas.inadimplentes.length === 0 && (
                <p className="px-1 pb-3 text-sm text-foreground/40">
                  Nenhum aluno inadimplente.
                </p>
              )}
              {alertas.inadimplentes.map((a) => (
                <div
                  key={a.id}
                  className="mb-2 flex items-center justify-between gap-2 rounded-lg border border-surface-border px-3 py-2"
                >
                  <div className="flex items-center gap-1.5">
                    <PontoNovo novo={a.novo} />
                    <div>
                      <p className="text-sm text-foreground">{a.nome}</p>
                      <p className="text-xs text-error">
                        Venceu há {Math.abs(a.dias)}d
                      </p>
                    </div>
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

              <p className="mb-2 mt-3 px-1 text-[10px] font-semibold uppercase tracking-wider text-foreground/40">
                Vencendo em até 3 dias
              </p>
              {alertas.vencendo.length === 0 && (
                <p className="px-1 pb-3 text-sm text-foreground/40">
                  Nenhuma matrícula vencendo.
                </p>
              )}
              {alertas.vencendo.map((a) => (
                <div
                  key={a.id}
                  className="mb-2 flex items-center justify-between gap-2 rounded-lg border border-surface-border px-3 py-2"
                >
                  <div className="flex items-center gap-1.5">
                    <PontoNovo novo={a.novo} />
                    <div>
                      <p className="text-sm text-foreground">{a.nome}</p>
                      <p className="text-xs text-warning">
                        {a.dias === 0 ? "Vence hoje" : `Vence em ${a.dias}d`}
                      </p>
                    </div>
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

              {alertas.preCadastros.length > 0 && (
                <>
                  <p className="mb-2 mt-3 px-1 text-[10px] font-semibold uppercase tracking-wider text-foreground/40">
                    Pré-cadastros pendentes
                  </p>
                  <Link
                    href="/pre-cadastros"
                    onClick={() => setAberto(false)}
                    className="mb-2 flex items-center gap-1.5 rounded-lg border border-primary/20 bg-primary/10 px-3 py-2 text-sm text-primary hover:bg-primary/20"
                  >
                    <PontoNovo
                      novo={alertas.preCadastros.some((a) => a.novo)}
                    />
                    {alertas.preCadastros.length} pré-cadastro(s) aguardando
                    revisão
                  </Link>
                </>
              )}

              {alertas.novasMatriculas.length > 0 && (
                <>
                  <p className="mb-2 mt-3 px-1 text-[10px] font-semibold uppercase tracking-wider text-foreground/40">
                    Novas matrículas
                  </p>
                  <Link
                    href="/matriculas"
                    onClick={() => setAberto(false)}
                    className="flex items-center gap-1.5 rounded-lg border border-primary/20 bg-primary/10 px-3 py-2 text-sm text-primary hover:bg-primary/20"
                  >
                    <PontoNovo
                      novo={alertas.novasMatriculas.some((a) => a.novo)}
                    />
                    {alertas.novasMatriculas.length} matrícula(s) aguardando
                    confirmação
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
