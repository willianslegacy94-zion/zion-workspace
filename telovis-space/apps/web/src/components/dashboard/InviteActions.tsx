"use client";

import { useActionState } from "react";
import { cancelInvite, resendInvite } from "@/app/dashboard/actions";
import InviteLink from "./InviteLink";

/** Reenviar (link novo) e cancelar um convite pendente. */
export default function InviteActions({ slug, inviteId }: { slug: string; inviteId: string }) {
  const [state, resend, pending] = useActionState(resendInvite, undefined);

  return (
    <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
      <div className="flex gap-1 text-sm">
        <form action={resend}>
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="inviteId" value={inviteId} />
          <button type="submit" disabled={pending} className="rounded-lg px-2 py-1 text-slate-300 hover:bg-white/5 disabled:opacity-50">
            {pending ? "Reenviando…" : "Reenviar"}
          </button>
        </form>
        <form
          action={cancelInvite}
          onSubmit={(e) => {
            if (!confirm("Cancelar este convite? O link deixa de valer.")) e.preventDefault();
          }}
        >
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="inviteId" value={inviteId} />
          <button type="submit" className="rounded-lg px-2 py-1 text-red-400 hover:bg-red-500/10">
            Cancelar
          </button>
        </form>
      </div>
      {state?.error && <p role="alert" className="text-xs text-red-400">{state.error}</p>}
      {state?.ok && <p role="status" className="text-xs text-emerald-400">{state.ok}</p>}
      {state?.inviteLink && <InviteLink link={state.inviteLink} />}
    </div>
  );
}
