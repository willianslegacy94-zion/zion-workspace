// Normaliza CNPJ pra dígitos puros — evita duas linhas de Fornecedor pro
// mesmo CNPJ só porque um veio com pontuação (digitado à mão) e outro sem
// (extraído do XML da NFe).
export function normalizarCnpj(valor: string): string {
  return valor.replace(/\D/g, "");
}
