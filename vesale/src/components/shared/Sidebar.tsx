"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ShoppingCart,
  Boxes,
  Truck,
  FileStack,
  Wallet,
  TrendingUp,
  Users,
  ClipboardList,
  AlertTriangle,
  BarChart3,
  History,
  Sparkles,
} from "lucide-react";
import { PharmacyCross } from "@/components/shared/PharmacyCross";

type NavItem =
  | { label: string; href: string; icon: React.ComponentType<{ size?: number; className?: string }> }
  | {
      label: string;
      icon: React.ComponentType<{ size?: number; className?: string }>;
      children: { label: string; href: string }[];
    }
  | { label: string; icon: React.ComponentType<{ size?: number; className?: string }>; emBreve: true };

const NAV: NavItem[] = [
  { label: "Dashboard", href: "/painel", icon: LayoutDashboard },
  { label: "PDV / Vendas", href: "/pdv", icon: ShoppingCart },
  { label: "Estoque", href: "/estoque", icon: Boxes },
  {
    label: "Compras",
    icon: Truck,
    children: [
      { label: "Fornecedores", href: "/fornecedores" },
      { label: "Notas Fiscais", href: "/notas-fiscais" },
    ],
  },
  { label: "Validades", icon: FileStack, emBreve: true },
  { label: "Financeiro", href: "/financeiro", icon: Wallet },
  { label: "Lucro & Rentabilidade", href: "/rentabilidade", icon: TrendingUp },
  { label: "Clientes", icon: Users, emBreve: true },
  { label: "Receitas / Controlados", icon: ClipboardList, emBreve: true },
  { label: "Perdas", icon: AlertTriangle, emBreve: true },
  { label: "Relatórios", href: "/relatorios", icon: BarChart3 },
  { label: "Auditoria", icon: History, emBreve: true },
  { label: "Assistente IA", icon: Sparkles, emBreve: true },
];

// Itens ocultos por completo do operador de caixa — o dashboard gerencial e
// os módulos que expõem custo/margem, financeiro ou fornecedores.
const GESTOR_ONLY = new Set([
  "Dashboard",
  "Validades",
  "Financeiro",
  "Lucro & Rentabilidade",
  "Clientes",
  "Receitas / Controlados",
  "Perdas",
  "Relatórios",
  "Auditoria",
  "Assistente IA",
]);

// Dentro de um grupo com submenu, itens filhos ocultos do operador de caixa
// mesmo quando o grupo em si (ex.: "Compras") continua visível — o operador
// só enxerga "Notas Fiscais" (upload), nunca o cadastro de fornecedores.
const GESTOR_ONLY_CHILDREN = new Set(["Fornecedores"]);

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar({ papel }: { papel?: "GESTOR" | "OPERADOR_CAIXA" }) {
  const pathname = usePathname();
  const items = NAV.filter((item) => papel === "GESTOR" || !GESTOR_ONLY.has(item.label))
    .map((item) =>
      "children" in item && papel !== "GESTOR"
        ? { ...item, children: item.children.filter((child) => !GESTOR_ONLY_CHILDREN.has(child.label)) }
        : item,
    )
    .filter((item) => !("children" in item) || item.children.length > 0);

  return (
    <aside className="sticky top-0 flex h-screen w-[250px] shrink-0 flex-col overflow-y-auto bg-vesale-navy-dark px-3 py-5 text-white/80">
      <div className="mb-6 flex items-center gap-2 px-2">
        <PharmacyCross size={26} />
        <div className="leading-tight">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/50">Drogaria</p>
          <p className="text-lg font-black tracking-tight text-white">VESALE</p>
        </div>
      </div>

      <nav className="flex flex-col gap-0.5">
        {items.map((item) => {
          const Icon = item.icon;

          if ("emBreve" in item) {
            return (
              <div
                key={item.label}
                className="flex cursor-default items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-sm text-white/35"
              >
                <span className="flex items-center gap-2.5">
                  <Icon size={16} />
                  {item.label}
                </span>
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium">Em breve</span>
              </div>
            );
          }

          if ("children" in item) {
            const groupActive = item.children.some((c) => isActive(pathname, c.href));
            return (
              <div key={item.label} className="mt-0.5">
                <div
                  className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium ${
                    groupActive ? "text-white" : "text-white/70"
                  }`}
                >
                  <Icon size={16} />
                  {item.label}
                </div>
                <div className="ml-[26px] flex flex-col gap-0.5 border-l border-white/10 pl-3">
                  {item.children.map((child) => (
                    <Link
                      key={child.href}
                      href={child.href}
                      className={`rounded-lg px-3 py-2 text-sm transition ${
                        isActive(pathname, child.href)
                          ? "bg-white/10 text-white"
                          : "text-white/60 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      {child.label}
                    </Link>
                  ))}
                </div>
              </div>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                isActive(pathname, item.href) ? "bg-vesale-red text-white" : "text-white/70 hover:bg-white/10 hover:text-white"
              }`}
            >
              <Icon size={16} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
