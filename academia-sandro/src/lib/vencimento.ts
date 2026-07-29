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

// O campo statusPagamento é setado manualmente e não se atualiza sozinho —
// isso já causou tela mostrando "Em dia" pra aluno com vencimento no passado.
// Sempre exibir esse valor derivado (data manda), nunca o campo bruto direto.
export function statusPagamentoEfetivo(aluno: {
  statusPagamento: string;
  dataVencimento: Date | null;
}): string {
  if (aluno.dataVencimento && diasParaVencer(aluno.dataVencimento) < 0) {
    return "Atrasado";
  }
  return aluno.statusPagamento;
}
