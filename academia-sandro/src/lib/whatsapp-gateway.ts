// Conexão real de WhatsApp do CT via Evolution API (mesmo gateway
// self-hosted compartilhado pela Holding — ver evolution-api/docker-compose.yml
// e o padrão já usado em lane-confeitaria/src/server/services/whatsappService.ts
// e orbita-cortex/main.py). Diferente de src/lib/whatsapp.ts (que só monta
// links wa.me pra clique manual), este arquivo manda mensagem de verdade,
// sem intervenção humana — usado pelos itens 7 (bloqueio de agenda avisa o
// aluno) e 8 (pré-cadastro com aula experimental avisa o admin).
//
// Em dev local a rede Docker `orbita_shared` não existe (só na VPS), então
// toda função aqui trata falha de conexão sem lançar — a página continua
// funcionando normalmente, só sem o envio real.

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || "http://localhost:8081";
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || "";
const INSTANCE_NAME = process.env.EVOLUTION_INSTANCE_NAME || "academia-sandro-admin";

function headers() {
  return { apikey: EVOLUTION_API_KEY, "Content-Type": "application/json" };
}

// Número cadastrado sem o DDI (55) faz a Evolution API recusar o envio
// (WhatsApp reporta o JID como inexistente) — normaliza antes de mandar.
function normalizarTelefone(telefone: string): string {
  const digitos = telefone.replace(/\D/g, "");
  const semDDI = digitos.length === 10 || digitos.length === 11;
  return semDDI && !digitos.startsWith("55") ? `55${digitos}` : digitos;
}

export type StatusConexao = { conectado: boolean; estado: string };

export async function buscarStatusConexao(): Promise<StatusConexao> {
  try {
    const resp = await fetch(`${EVOLUTION_API_URL}/instance/connectionState/${INSTANCE_NAME}`, {
      headers: headers(),
      cache: "no-store",
    });
    if (!resp.ok) return { conectado: false, estado: "desconhecido" };
    const dados = await resp.json();
    const estado = dados?.instance?.state ?? "desconhecido";
    return { conectado: estado === "open", estado };
  } catch {
    return { conectado: false, estado: "erro_conexao" };
  }
}

export type QrCode = { base64: string | null; erro?: string };

// Cria a instância na Evolution API se ainda não existir (1ª vez que o admin
// abre essa tela), senão só busca um QR code novo pra instância existente —
// chamar /instance/create de novo numa instância já existente reinicia a
// sessão à toa.
export async function buscarQrCode(): Promise<QrCode> {
  try {
    const conectar = await fetch(`${EVOLUTION_API_URL}/instance/connect/${INSTANCE_NAME}`, {
      headers: headers(),
      cache: "no-store",
    });

    if (conectar.ok) {
      const dados = await conectar.json();
      if (dados?.base64) return { base64: dados.base64 };
      return { base64: null };
    }

    if (conectar.status === 404) {
      const criar = await fetch(`${EVOLUTION_API_URL}/instance/create`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          instanceName: INSTANCE_NAME,
          qrcode: true,
          integration: "WHATSAPP-BAILEYS",
        }),
      });
      if (!criar.ok) return { base64: null, erro: `Falha ao criar instância (HTTP ${criar.status}).` };
      const dados = await criar.json();
      return { base64: dados?.qrcode?.base64 ?? null };
    }

    return { base64: null, erro: `Falha ao buscar QR code (HTTP ${conectar.status}).` };
  } catch (erro) {
    return { base64: null, erro: `Erro de conexão com a Evolution API: ${erro}` };
  }
}

export async function desconectarWhatsapp(): Promise<{ success: boolean; error?: string }> {
  try {
    const resp = await fetch(`${EVOLUTION_API_URL}/instance/logout/${INSTANCE_NAME}`, {
      method: "DELETE",
      headers: headers(),
    });
    if (!resp.ok) return { success: false, error: `HTTP ${resp.status}` };
    return { success: true };
  } catch (erro) {
    return { success: false, error: String(erro) };
  }
}

// Envio real de mensagem (não é wa.me/clique manual). Nunca lança — quem
// chama decide se loga e segue; uma falha de WhatsApp nunca pode derrubar
// uma action de negócio (criar bloqueio, salvar pré-cadastro, etc).
export async function enviarWhatsapp(
  telefone: string,
  mensagem: string,
): Promise<{ enviado: boolean; erro?: string }> {
  if (!EVOLUTION_API_KEY) {
    return { enviado: false, erro: "EVOLUTION_API_KEY não configurada." };
  }

  try {
    const resp = await fetch(`${EVOLUTION_API_URL}/message/sendText/${INSTANCE_NAME}`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ number: normalizarTelefone(telefone), text: mensagem }),
    });
    if (!resp.ok) {
      return { enviado: false, erro: `Evolution API respondeu HTTP ${resp.status}` };
    }
    return { enviado: true };
  } catch (erro) {
    return { enviado: false, erro: String(erro) };
  }
}
