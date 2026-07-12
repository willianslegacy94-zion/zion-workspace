export function calcularVencimento(dataBase: Date): Date {
  const venc = new Date(dataBase);
  venc.setDate(venc.getDate() + 30);
  return venc;
}

export function diasParaVencer(dataVencimento: Date): number {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const venc = new Date(dataVencimento);
  venc.setHours(0, 0, 0, 0);
  const diffMs = venc.getTime() - hoje.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}
