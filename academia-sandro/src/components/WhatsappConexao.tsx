"use client";

import { useEffect, useState } from "react";
import {
  buscarQrCodeAction,
  buscarStatusConexaoAction,
  desconectarWhatsappAction,
  buscarNumeroConectadoAction,
  sincronizarTelefonePerfilAction,
} from "@/app/(app)/configuracoes/whatsapp-actions";

export function WhatsappConexao() {
  const [conectado, setConectado] = useState<boolean | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [numeroConectado, setNumeroConectado] = useState<string | null>(null);
  const [sincronizando, setSincronizando] = useState(false);
  const [sincronizado, setSincronizado] = useState(false);

  async function atualizarStatus() {
    const status = await buscarStatusConexaoAction();
    setConectado(status.conectado);
    return status.conectado;
  }

  async function carregarQrCode() {
    setCarregando(true);
    setErro(null);
    const resultado = await buscarQrCodeAction();
    if (resultado.erro) setErro(resultado.erro);
    setQrCode(resultado.base64);
    setCarregando(false);
  }

  // Ao entrar na tela: checa status; se não estiver conectado, já busca o
  // QR code pro admin escanear sem precisar clicar em nada.
  useEffect(() => {
    (async () => {
      const jaConectado = await atualizarStatus();
      if (!jaConectado) await carregarQrCode();
    })();
  }, []);

  // Enquanto não conectar, verifica o status a cada 3s — assim que o admin
  // escanear no celular, a tela atualiza sozinha pra "Conectado".
  useEffect(() => {
    if (conectado) return;
    const intervalo = setInterval(async () => {
      const agora = await atualizarStatus();
      if (agora) setQrCode(null);
    }, 3000);
    return () => clearInterval(intervalo);
  }, [conectado]);

  // Assim que conectar, busca o número pareado — só pra oferecer o atalho
  // de sincronizar com o campo Telefone do Perfil (ver texto explicativo
  // abaixo). Se a Evolution API não devolver o número (formato de resposta
  // varia por versão), o botão de atalho simplesmente não aparece.
  useEffect(() => {
    if (!conectado) return;
    (async () => {
      const { numero } = await buscarNumeroConectadoAction();
      setNumeroConectado(numero);
    })();
  }, [conectado]);

  async function sincronizarTelefone() {
    if (!numeroConectado) return;
    setSincronizando(true);
    await sincronizarTelefonePerfilAction(numeroConectado);
    setSincronizando(false);
    setSincronizado(true);
  }

  async function desconectar() {
    if (
      !confirm(
        "Desconectar o WhatsApp do CT? Bloqueios de agenda e avisos de aula experimental param de ser enviados até reconectar.",
      )
    ) {
      return;
    }
    await desconectarWhatsappAction();
    setConectado(false);
    await carregarQrCode();
  }

  if (conectado === null) {
    return <p className="text-sm text-foreground/50">Verificando conexão...</p>;
  }

  if (conectado) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-lg border border-success/30 bg-success/10 p-4">
        <p className="text-sm font-medium text-success">✅ WhatsApp conectado</p>
        <p className="text-xs text-foreground/60">
          Bloqueios de agenda (aluno) e agendamentos de aula experimental
          (admin) já são enviados automaticamente por esse número. Esse é o
          número que <strong>envia</strong> as mensagens — diferente do campo
          Telefone em Configurações → Perfil, que é só pra onde os avisos
          administrativos chegam.
        </p>

        {numeroConectado && !sincronizado && (
          <button
            type="button"
            onClick={sincronizarTelefone}
            disabled={sincronizando}
            className="text-xs text-primary hover:underline disabled:opacity-50"
          >
            {sincronizando
              ? "Sincronizando..."
              : `Usar esse número (${numeroConectado}) também como Telefone do Perfil`}
          </button>
        )}
        {sincronizado && (
          <p className="text-xs text-success">
            Telefone do Perfil atualizado com esse número.
          </p>
        )}

        <button
          type="button"
          onClick={desconectar}
          className="text-xs text-error hover:underline"
        >
          Desconectar
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-foreground/10 p-4">
      <p className="text-sm text-foreground">
        Abra o WhatsApp no celular do CT → <strong>Aparelhos conectados</strong> →{" "}
        <strong>Conectar um aparelho</strong>, e escaneie o código abaixo.
      </p>

      {carregando && <p className="text-xs text-foreground/50">Gerando QR code...</p>}
      {erro && (
        <p className="text-xs text-error">
          {erro} — se estiver em ambiente local, isso é esperado (o gateway só
          existe na VPS de produção).
        </p>
      )}

      {qrCode && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={qrCode}
          alt="QR code para conectar o WhatsApp"
          className="h-64 w-64 rounded-lg border border-foreground/10"
        />
      )}

      <button
        type="button"
        onClick={carregarQrCode}
        disabled={carregando}
        className="text-xs text-primary hover:underline disabled:opacity-50"
      >
        Gerar novo QR code
      </button>
    </div>
  );
}
