/** Formata um valor (number, string ou Prisma.Decimal já convertido) como BRL. */
export function formatBRL(value: number | string | null | undefined): string {
  const numero = typeof value === "string" ? Number(value) : (value ?? 0);
  return numero.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
