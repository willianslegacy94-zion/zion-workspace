import { logout } from "@/server/actions/auth";

export function Topbar({ userName }: { userName?: string | null }) {
  return (
    <header className="flex h-[64px] shrink-0 items-center justify-end border-b border-vesale-border bg-vesale-surface px-6">
      <form action={logout} className="flex items-center gap-3">
        {userName && <span className="text-sm text-vesale-muted">{userName}</span>}
        <button
          type="submit"
          className="rounded-md border border-vesale-border px-3 py-1.5 text-xs font-medium text-vesale-ink transition hover:bg-vesale-bg"
        >
          Sair
        </button>
      </form>
    </header>
  );
}
