"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarClock,
  ClipboardCheck,
  LayoutDashboard,
  Lock,
  LogOut,
  Menu,
  Receipt,
  UserPlus,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { NotificacaoSino } from "./NotificacaoSino";
import type { Alertas } from "@/lib/alertas";

type ItemMenu = {
  id: string;
  label: string;
  href: string;
  icon: typeof Users;
  disabled?: boolean;
  badge?: number;
};

type Grupo = {
  label: string;
  items: ItemMenu[];
};

function montarGrupos(
  preCadastrosPendentes: number,
  matriculasPendentes: number,
): Grupo[] {
  return [
    {
      label: "Principal",
      items: [
        {
          id: "dashboard",
          label: "Dashboard",
          href: "/",
          icon: LayoutDashboard,
        },
        { id: "alunos", label: "Alunos", href: "/alunos", icon: Users },
        { id: "agenda", label: "Agenda", href: "/agenda", icon: CalendarClock },
        {
          id: "matriculas",
          label: "Novas Matrículas",
          href: "/matriculas",
          icon: ClipboardCheck,
          badge: matriculasPendentes || undefined,
        },
        {
          id: "transacoes",
          label: "Transações",
          href: "/transacoes",
          icon: Wallet,
        },
        {
          id: "despesas",
          label: "Despesas",
          href: "/despesas",
          icon: Receipt,
        },
        {
          id: "pre-cadastros",
          label: "Pré-cadastros",
          href: "/pre-cadastros",
          icon: UserPlus,
          badge: preCadastrosPendentes || undefined,
        },
      ],
    },
  ];
}

export function AppShell({
  username,
  nome,
  logoutAction,
  alertas,
  marcarAlertasComoLidos,
  preCadastrosPendentes,
  matriculasPendentes,
  children,
}: {
  username?: string;
  nome?: string | null;
  logoutAction: () => Promise<void>;
  alertas: Alertas;
  marcarAlertasComoLidos: () => Promise<void>;
  preCadastrosPendentes: number;
  matriculasPendentes: number;
  children: React.ReactNode;
}) {
  const [aberto, setAberto] = useState(false);
  const pathname = usePathname();
  const GRUPOS = montarGrupos(preCadastrosPendentes, matriculasPendentes);

  return (
    <div className="flex min-h-full">
      {aberto && (
        <div
          className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setAberto(false)}
        />
      )}

      <aside
        className={`fixed top-0 left-0 z-40 flex h-full w-64 flex-col bg-surface
                    border-r border-surface-border transition-transform duration-300 ease-in-out
                    lg:translate-x-0 ${aberto ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="h-0.5 w-full shrink-0 bg-gold-gradient" />

        <div className="flex shrink-0 items-center justify-between border-b border-surface-border px-4 py-4">
          <Link href="/" onClick={() => setAberto(false)}>
            <p className="text-[9px] font-semibold uppercase tracking-[0.25em] text-secondary">
              Centro de Treinamento
            </p>
            <p className="font-serif text-lg font-bold leading-tight tracking-widest text-gold-shimmer">
              Sandro Ferreira
            </p>
            <p className="mt-0.5 text-[9px] uppercase tracking-[0.3em] text-foreground/40">
              Sistema de Gestão
            </p>
          </Link>
          <button
            onClick={() => setAberto(false)}
            aria-label="Fechar menu"
            className="rounded-lg p-1.5 text-foreground/50 transition-all duration-200 hover:bg-surface-hover hover:text-primary lg:hidden"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-3">
          {GRUPOS.map((grupo) => (
            <div key={grupo.label} className="mb-5">
              <p className="mb-1.5 px-2 text-[9px] font-semibold uppercase tracking-[0.2em] text-foreground/30">
                {grupo.label}
              </p>
              {grupo.items.map((item) => {
                const Icon = item.icon;

                if (item.disabled) {
                  return (
                    <span
                      key={item.id}
                      title="Em desenvolvimento"
                      className="mb-0.5 flex w-full cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground/25"
                    >
                      <Icon size={15} className="shrink-0" />
                      <span className="flex-1 truncate text-left">
                        {item.label}
                      </span>
                      <Lock size={9} className="shrink-0 text-foreground/20" />
                    </span>
                  );
                }

                const ativo =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.href);

                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    onClick={() => setAberto(false)}
                    className={`mb-0.5 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                      ativo
                        ? "border border-primary/20 bg-primary/10 text-primary"
                        : "text-foreground/60 hover:bg-surface-hover hover:text-primary"
                    }`}
                  >
                    <Icon size={15} className="shrink-0" />
                    <span className="flex-1 truncate text-left">
                      {item.label}
                    </span>
                    {!!item.badge && (
                      <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-error px-1 text-[10px] font-semibold text-white">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="shrink-0 border-t border-surface-border p-3">
          {(nome ?? username) && (
            <p className="mb-2 truncate px-3 text-xs text-foreground/40">
              Logado como{" "}
              <span className="text-foreground/70">{nome ?? username}</span>
            </p>
          )}
          <form action={logoutAction}>
            <button
              type="submit"
              className="flex w-full items-center gap-3 rounded-lg border border-transparent px-3 py-2.5 text-sm font-medium text-foreground/60 transition-all duration-200 hover:border-error/20 hover:bg-error/5 hover:text-error"
            >
              <LogOut size={15} />
              <span>Sair</span>
            </button>
          </form>
        </div>
      </aside>

      <div className="flex min-h-full min-w-0 flex-1 flex-col lg:pl-64">
        <div className="flex items-center justify-between gap-3 border-b border-surface-border px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setAberto(true)}
              aria-label="Abrir menu"
              className="rounded-lg p-1.5 text-foreground/60 transition-colors hover:bg-surface-hover hover:text-primary lg:hidden"
            >
              <Menu size={20} />
            </button>
            <span className="text-sm font-semibold text-primary lg:hidden">
              Centro de Treinamento
            </span>
            {nome && (
              <span className="hidden text-sm font-medium text-foreground/70 lg:block">
                Bem-vindo, <span className="text-primary">{nome}</span>
              </span>
            )}
          </div>

          <NotificacaoSino
            alertas={alertas}
            marcarAlertasComoLidos={marcarAlertasComoLidos}
          />
        </div>

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
