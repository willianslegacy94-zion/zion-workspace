import { Sidebar } from "@/components/shared/Sidebar";
import { Topbar } from "@/components/shared/Topbar";

export function AppShell({
  userName,
  papel,
  children,
}: {
  userName?: string | null;
  papel?: "GESTOR" | "OPERADOR_CAIXA";
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <Sidebar papel={papel} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar userName={userName} />
        <main className="flex-1 bg-vesale-bg">{children}</main>
      </div>
    </div>
  );
}
