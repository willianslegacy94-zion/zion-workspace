// Contas de suporte/teste que devem sempre existir no sistema (inclusive em produção),
// usadas pelo Willians para diagnosticar problemas como aluno e como admin.
export const USERNAMES_FIXOS = ["devaluno", "devmaster"];

export function ehContaFixa(username?: string | null) {
  return !!username && USERNAMES_FIXOS.includes(username);
}
