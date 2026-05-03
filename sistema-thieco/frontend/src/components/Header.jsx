export default function Header() {
  return (
    <header className="relative border-b border-surface-border bg-onix-200/80 backdrop-blur-sm">
      {/* Linha dourada topo */}
      <div className="h-0.5 w-full bg-gold-gradient" />

      <div className="max-w-7xl mx-auto px-6 py-5 flex flex-col items-center gap-1">
        {/* BARBEARIA */}
        <div className="gold-divider w-full max-w-xs">
          <span className="text-xs font-serif tracking-[0.35em] text-gold-dark uppercase">
            Barbearia
          </span>
        </div>

        {/* THIECO LEANDRO */}
        <h1 className="font-serif font-black text-3xl sm:text-4xl tracking-widest text-gold-shimmer leading-none">
          Thieco Leandro
        </h1>

        {/* Slogans */}
        <p className="text-gold-light/70 text-xs sm:text-sm font-serif italic tracking-wide text-center mt-1">
          Autoestima Muda Destinos.{' '}
          <span className="text-gold font-semibold not-italic">Confiança Muda Tudo.</span>
        </p>

        {/* Subtítulo sistema */}
        <span className="mt-2 text-[10px] uppercase tracking-[0.3em] text-gold-muted font-sans">
          Sistema de Caixa
        </span>
      </div>

      {/* Linha dourada base */}
      <div className="h-px w-full bg-gold-gradient opacity-40" />
    </header>
  );
}
