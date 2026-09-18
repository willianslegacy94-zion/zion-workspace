// Tipos compartilhados entre o parser determinístico (XML padrão NFe) e o
// fallback via IA (PDF/DANFE ou XML fora do padrão) — RF-015/RF-016.

export type ItemNotaExtraido = {
  descricaoFornecedor: string;
  quantidade: number;
  custoUnitario: number;
  ncm: string | null;
  codigoBarras: string | null;
  // RN-014 — vem do grupo `rastro` do XML quando o item tem controle de
  // lote; nulo quando a nota não traz essa informação (aí é preenchido à
  // mão na conciliação, se o produto vinculado for medicamentoControlado).
  numeroLote: string | null;
  validade: string | null;
};

export type NotaFiscalExtraida = {
  fornecedor: { razaoSocial: string; cnpj: string } | null;
  chaveAcessoNfe: string | null;
  valorTotal: number | null;
  itens: ItemNotaExtraido[];
};
