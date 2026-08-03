"use server";

import * as whatsappGateway from "@/lib/whatsapp-gateway";

export async function buscarStatusConexaoAction() {
  return whatsappGateway.buscarStatusConexao();
}

export async function buscarQrCodeAction() {
  return whatsappGateway.buscarQrCode();
}

export async function desconectarWhatsappAction() {
  return whatsappGateway.desconectarWhatsapp();
}
