// Cruz de farmácia — reproduz a marca da fachada real (círculo vermelho,
// cruz branca) já que não existe arquivo vetorial da logo, só a foto
// (LogoVesale.png, ver registro-de-decisoes-vesale.md).
export function PharmacyCross({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      className={className}
      role="img"
      aria-label="Cruz da farmácia"
    >
      <circle cx="24" cy="24" r="22" fill="var(--color-vesale-red)" />
      <path d="M20 9h8v11h11v8H28v11h-8V28H9v-8h11z" fill="#ffffff" />
    </svg>
  );
}
