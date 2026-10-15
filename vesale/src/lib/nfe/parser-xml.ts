import { XMLParser } from "fast-xml-parser";
import type { ItemNotaExtraido, NotaFiscalExtraida } from "./types";

// Parser determinístico para XML no padrão NFe (SEFAZ) — RF-015. Cobre só o
// caso feliz: se a estrutura esperada (emit/det/total) não estiver presente,
// retorna null para a camada de upload acionar o fallback via IA (RF-016).
// Ver arquitetura-vesale.md § 1 — parsing determinístico é o caminho
// principal, mais barato e confiável; a IA nunca é acionada quando o XML
// segue o schema oficial.

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });

// GTIN placeholder usado pela SEFAZ quando o produto não tem código de barras.
const CODIGOS_BARRA_INVALIDOS = new Set(["SEM GTIN", "SEM GTIN "]);

function normalizarCodigoBarras(valor: unknown): string | null {
  const texto = String(valor ?? "").trim();
  if (!texto || CODIGOS_BARRA_INVALIDOS.has(texto.toUpperCase())) return null;
  return texto;
}

// RN-014 — grupo opcional do XML (rastreabilidade de lote, comum em
// medicamentos). Pode vir repetido (vários lotes por item); usamos só o
// primeiro — é o suficiente pra pré-preencher a conciliação, que sempre
// permite o gestor corrigir antes de confirmar.
function extrairLote(prod: Record<string, unknown>): { numeroLote: string | null; validade: string | null } {
  const rastroRaw = prod.rastro as Record<string, unknown> | Record<string, unknown>[] | undefined;
  const rastro = Array.isArray(rastroRaw) ? rastroRaw[0] : rastroRaw;
  if (!rastro || !rastro.nLote) return { numeroLote: null, validade: null };

  return {
    numeroLote: String(rastro.nLote).trim(),
    validade: rastro.dValLote ? String(rastro.dValLote).trim() : null,
  };
}

function normalizarItem(det: Record<string, unknown>): ItemNotaExtraido | null {
  const prod = det?.prod as Record<string, unknown> | undefined;
  if (!prod || !prod.xProd || prod.qCom === undefined || prod.vUnCom === undefined) return null;

  const quantidade = Number(prod.qCom);
  const custoUnitario = Number(prod.vUnCom);
  if (!Number.isFinite(quantidade) || !Number.isFinite(custoUnitario)) return null;

  const { numeroLote, validade } = extrairLote(prod);

  return {
    descricaoFornecedor: String(prod.xProd).trim(),
    quantidade,
    custoUnitario,
    ncm: prod.NCM ? String(prod.NCM).trim() : null,
    codigoBarras: normalizarCodigoBarras(prod.cEAN),
    numeroLote,
    validade,
  };
}

export function parseNfeXml(xml: string): NotaFiscalExtraida | null {
  let doc: Record<string, unknown>;
  try {
    doc = parser.parse(xml);
  } catch {
    return null;
  }

  const nfe = (doc.nfeProc as Record<string, unknown> | undefined)?.NFe ?? doc.NFe;
  const infNFe = (nfe as Record<string, unknown> | undefined)?.infNFe as
    | Record<string, unknown>
    | undefined;
  if (!infNFe) return null;

  const emit = infNFe.emit as Record<string, unknown> | undefined;
  if (!emit?.CNPJ || !emit?.xNome) return null;

  const detRaw = infNFe.det;
  const detList = Array.isArray(detRaw) ? detRaw : detRaw ? [detRaw] : [];
  if (detList.length === 0) return null;

  const itens = detList
    .map((det) => normalizarItem(det as Record<string, unknown>))
    .filter((item): item is ItemNotaExtraido => item !== null);
  if (itens.length === 0) return null;

  const total = infNFe.total as Record<string, unknown> | undefined;
  const icmsTot = total?.ICMSTot as Record<string, unknown> | undefined;
  const valorTotal = icmsTot?.vNF !== undefined ? Number(icmsTot.vNF) : null;

  const chaveAcessoNfe = String(infNFe["@_Id"] ?? "").replace(/^NFe/, "") || null;

  return {
    fornecedor: { razaoSocial: String(emit.xNome).trim(), cnpj: String(emit.CNPJ).trim() },
    chaveAcessoNfe,
    valorTotal: valorTotal !== null && Number.isFinite(valorTotal) ? valorTotal : null,
    itens,
  };
}
