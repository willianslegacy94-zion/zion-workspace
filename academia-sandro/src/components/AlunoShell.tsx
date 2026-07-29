"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarClock,
  ClipboardList,
  LogOut,
  Menu,
  Wallet,
  X,
} from "lucide-react";

const ITENS = [
  { id: "inicio", label: "Agenda", href: "/aluno", icon: CalendarClock },
  {
    id: "matricula",
    label: "Matrícula",
    href: "/aluno/matricula",
    icon: ClipboardList,
  },
  { id: "financeiro", label: "Financeiro", href: "/aluno/financeiro", icon: Wallet },
];

export function AlunoShell({
  nome,
  logoutAction,
  children,
}: {
  nome: string;
  logoutAction: () => Promise<void>;
  children: React.ReactNode;
}) {
  const [aberto, setAberto] = useState(false);
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen">
      {aberto && (
        <div
          className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setAberto(false)}
        />
      )}

      <aside
        className={`fixed top-0 left-0 z-40 flex h-full w-60 flex-col bg-surface
                    border-r border-surface-border transition-transform duration-300 ease-in-out
                    lg:translate-x-0 ${aberto ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="h-0.5 w-full shrink-0 bg-gold-gradient" />

        <div className="flex shrink-0 items-center gap-3 border-b border-surface-border px-4 py-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-secondary/40 bg-primary/10 font-serif text-sm font-bold text-primary">
            {nome.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">
              {nome}
            </p>
            <p className="text-[10px] uppercase tracking-[0.2em] text-foreground/40">
              Área do Aluno
            </p>
          </div>
          <button
            onClick={() => setAberto(false)}
            aria-label="Fechar menu"
            className="rounded-lg p-1.5 text-foreground/50 transition-all duration-200 hover:bg-surface-hover hover:text-primary lg:hidden"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-3">
          {ITENS.map((item) => {
            const Icon = item.icon;
            const ativo =
              item.href === "/aluno"
                ? pathname === "/aluno"
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
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="shrink-0 border-t border-surface-border p-3">
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

      <div className="flex min-h-screen min-w-0 flex-1 flex-col lg:pl-60">
        <div className="flex items-center gap-3 border-b border-surface-border px-4 py-3 lg:hidden">
          <button
            onClick={() => setAberto(true)}
            aria-label="Abrir menu"
            className="rounded-lg p-1.5 text-foreground/60 transition-colors hover:bg-surface-hover hover:text-primary"
          >
            <Menu size={20} />
          </button>
          <span className="text-sm font-semibold text-primary">
            Área do Aluno
          </span>
        </div>

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6">{children}</main>
      </div>
    </div>
  );
}
