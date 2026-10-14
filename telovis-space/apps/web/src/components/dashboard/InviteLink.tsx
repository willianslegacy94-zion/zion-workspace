"use client";

import { useState } from "react";
import { inputClass } from "./ui";

/** Link de convite somente leitura com botão de copiar. */
export default function InviteLink({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex gap-2">
      <input
        readOnly
        value={link}
        aria-label="Link do convite"
        onFocus={(e) => e.currentTarget.select()}
        className={`${inputClass} min-w-0 flex-1 font-mono text-xs`}
      />
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(link);
            setCopied(true);
            setTimeout(() => setCopied(false), 2_000);
          } catch {
            // Sem permissão de área de transferência: o campo já fica selecionável.
          }
        }}
        className="rounded-lg border border-slate-700 px-3 py-2 text-sm hover:border-slate-500"
      >
        {copied ? "Copiado!" : "Copiar"}
      </button>
    </div>
  );
}
