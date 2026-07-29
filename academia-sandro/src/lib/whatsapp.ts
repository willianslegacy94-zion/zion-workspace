export function montarLinkWhatsapp(telefone: string, mensagem: string): string {
  const digitos = telefone.replace(/\D/g, "");
  return `https://wa.me/55${digitos}?text=${encodeURIComponent(mensagem)}`;
}

export function mensagemAcessoPortal(nome: string, link: string): string {
  const primeiroNome = nome.trim().split(/\s+/)[0];
  return `Olá ${primeiroNome}! Seu acesso ao portal do Centro de Treinamento Sandro Ferreira foi liberado. Defina sua senha aqui: ${link}`;
}

export function mensagemCobranca(nome: string, dias: number): string {
  const primeiroNome = nome.trim().split(/\s+/)[0];
  if (dias < 0) {
    return `Olá ${primeiroNome}! Sua mensalidade do Centro de Treinamento Sandro Ferreira já venceu. Poderia regularizar o pagamento? 🙏`;
  }
  if (dias === 0) {
    return `Olá ${primeiroNome}! Sua mensalidade do Centro de Treinamento Sandro Ferreira vence hoje. Poderia regularizar o pagamento? 🙏`;
  }
  return `Olá ${primeiroNome}! Sua mensalidade do Centro de Treinamento Sandro Ferreira vence em ${dias} dia(s). Poderia regularizar o pagamento? 🙏`;
}
