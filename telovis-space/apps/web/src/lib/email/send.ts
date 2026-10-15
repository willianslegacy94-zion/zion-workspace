import "server-only";

// Envio de e-mail pela API HTTP do Resend (sem SDK). Sem RESEND_API_KEY e
// EMAIL_FROM configurados — o normal em desenvolvimento —, nada é enviado: o
// conteúdo vai para o log e quem chamou mostra o link na tela.

export interface Email {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export type SendResult = { delivered: true } | { delivered: false; reason: string };

const RESEND_URL = "https://api.resend.com/emails";
const TIMEOUT_MS = 5_000;

export async function sendEmail(email: Email): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from) {
    console.info(`[email] envio desligado (sem RESEND_API_KEY/EMAIL_FROM). Para ${email.to}:\n${email.text}`);
    return { delivered: false, reason: "envio de e-mail não configurado" };
  }

  try {
    const res = await fetch(RESEND_URL, {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ from, to: [email.to], subject: email.subject, html: email.html, text: email.text }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      console.error(`[email] Resend respondeu ${res.status}: ${await res.text()}`);
      return { delivered: false, reason: "o provedor de e-mail recusou o envio" };
    }
    return { delivered: true };
  } catch (err) {
    console.error("[email] falha ao enviar", err);
    return { delivered: false, reason: "falha ao falar com o provedor de e-mail" };
  }
}

/** Escapa texto vindo de usuário (nomes) antes de entrar no HTML do e-mail. */
export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
