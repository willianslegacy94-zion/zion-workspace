import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { NotaFiscalExtraida } from "./types";

// Fallback de extração via Claude API — RF-016. Acionado só quando o parser
// determinístico (parser-xml.ts) não reconhece a estrutura: PDF (DANFE) ou
// XML fora do padrão NFe. Toda nota extraída por aqui nasce com origemExtracao
// IA_ASSISTIDA e fica marcada para conferência manual antes de conciliar
// (RF-016, RN-007) — a IA nunca grava vínculo/estoque sozinha.
//
// Modelo: Sonnet 5, não Opus — extração estruturada de campos já conhecidos
// (NFe/DANFE) não exige o modelo mais caro, decisão explícita de custo do
// projeto (ver arquitetura-vesale.md § 1).

const client = new Anthropic();

const ItemExtraidoSchema = z.object({
  descricaoFornecedor: z.string(),
  quantidade: z.number().positive(),
  custoUnitario: z.number().nonnegative(),
  ncm: z.string().nullable(),
  codigoBarras: z.string().nullable(),
  numeroLote: z.string().nullable(),
  validade: z.string().nullable(),
});

const NotaExtraidaSchema = z.object({
  fornecedorRazaoSocial: z.string().nullable(),
  fornecedorCnpj: z.string().nullable(),
  chaveAcessoNfe: z.string().nullable(),
  valorTotal: z.number().nullable(),
  itens: z.array(ItemExtraidoSchema),
});

const SYSTEM_PROMPT = `Você extrai dados estruturados de notas fiscais eletrônicas brasileiras (NFe) a
partir de um DANFE (PDF) ou de um XML fora do padrão oficial da SEFAZ.

Extraia: razão social e CNPJ do fornecedor (emitente), chave de acesso da NFe
(44 dígitos, se visível), valor total da nota, e cada item comprado — descrição
exatamente como aparece no documento, quantidade, custo unitário, NCM,
código de barras (GTIN/EAN) e, quando o item indicar lote/validade (comum em
medicamentos), o número do lote e a data de validade (formato AAAA-MM-DD).

Se um campo não estiver visível ou legível, retorne null para ele — nunca
invente valores. Quantidade e custo unitário são obrigatórios por item; se um
item não tiver esses dois valores legíveis, não o inclua na lista.`;

type EntradaExtracao = { tipo: "pdf"; bytes: Buffer } | { tipo: "xml"; texto: string };

export async function parseComIA(entrada: EntradaExtracao): Promise<NotaFiscalExtraida | null> {
  try {
    const response = await client.messages.parse({
      model: "claude-sonnet-5",
      max_tokens: 8000,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content:
            entrada.tipo === "pdf"
              ? [
                  {
                    type: "document",
                    source: {
                      type: "base64",
                      media_type: "application/pdf",
                      data: entrada.bytes.toString("base64"),
                    },
                  },
                  { type: "text", text: "Extraia os dados estruturados desta nota fiscal (DANFE)." },
                ]
              : [
                  {
                    type: "text",
                    text: `Extraia os dados estruturados deste XML de nota fiscal fora do padrão SEFAZ:\n\n${entrada.texto}`,
                  },
                ],
        },
      ],
      output_config: { format: zodOutputFormat(NotaExtraidaSchema) },
    });

    const extraido = response.parsed_output;
    if (!extraido) return null;

    return {
      fornecedor:
        extraido.fornecedorRazaoSocial && extraido.fornecedorCnpj
          ? { razaoSocial: extraido.fornecedorRazaoSocial, cnpj: extraido.fornecedorCnpj }
          : null,
      chaveAcessoNfe: extraido.chaveAcessoNfe,
      valorTotal: extraido.valorTotal,
      itens: extraido.itens,
    };
  } catch (error) {
    // Erro de API (rate limit, chave ausente, etc.) — a nota fica marcada
    // como ERRO pelo chamador; uma nota com erro nunca derruba outras
    // (RNF-006), então não relançamos.
    console.error("Falha na extração via IA de nota fiscal:", error);
    return null;
  }
}
