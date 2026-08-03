"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CopiarLink({ url }: { url: string }) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    await navigator.clipboard.writeText(url);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-foreground/10 px-4 py-3">
      <span className="text-xs text-foreground/50">Link de autocadastro:</span>
      <code className="flex-1 truncate text-sm text-primary">{url}</code>
      <button
        type="button"
        onClick={copiar}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-foreground/20 px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-foreground/5"
      >
        {copiado ? <Check size={14} className="text-success" /> : <Copy size={14} />}
        {copiado ? "Copiado!" : "Copiar link"}
      </button>
    </div>
  );
}
