export function montarLinkWhatsapp(telefone: string, mensagem: string): string {
  const digitos = telefone.replace(/\D/g, "");
  return `https://wa.me/55${digitos}?text=${encodeURIComponent(mensagem)}`;
}

export function mensagemCobranca(nome: string, dias: number): string {
  const primeiroNome = nome.trim().split(/\s+/)[0];
  if (dias < 0) {
    return `Olá ${primeiroNome}! Sua mensalidade da Academia Prof. Sandro já venceu. Poderia regularizar o pagamento? 🙏`;
  }
  if (dias === 0) {
    return `Olá ${primeiroNome}! Sua mensalidade da Academia Prof. Sandro vence hoje. Poderia regularizar o pagamento? 🙏`;
  }
  return `Olá ${primeiroNome}! Sua mensalidade da Academia Prof. Sandro vence em ${dias} dia(s). Poderia regularizar o pagamento? 🙏`;
}
