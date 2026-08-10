# 🧾 Emissão Fiscal (NFC-e) — Levantamento Técnico e Legal

Levantamento feito a partir de uma dúvida do cliente **Depósito Lobo** (`orbita-lobo`), mas o tema é transversal — qualquer ERP/PDV do ecossistema (Thieco, Villa Mill, IVSSTORE, Orbita Whitelabel) pode precisar emitir NFC-e eventualmente. Documentando aqui em vez de no repo do cliente porque é conhecimento reutilizável do portfólio.

> Comprovante atual (todos os PDVs Core) é só um cupom não-fiscal — sem valor legal perante o Fisco.

---

## 🚨 Prazo — SP (verificar com contador, fonte comercial)

Segundo o blog da Certisign (vendedora de certificado digital — não é fonte oficial da SEFAZ), **a partir de janeiro de 2026 a NFC-e (modelo 65) é obrigatória para todo estabelecimento varejista em SP, independente do porte**, sem exceção citada pra pequeno negócio. Não confirmar isso como definitivo sem checar direto na SEFAZ-SP ou com contador — mas é sinal de que não vale deixar pra depois em clientes/negócios paulistas (Depósito Lobo, Villa Mill, Thieco Tambore/Mutinga).

---

## ✅ Pré-requisitos (fora do código, por cliente/CNPJ)

Cada cliente que for emitir NFC-e precisa ter, **antes** de qualquer integração:

1. **CNPJ real e regularizado** (hoje em vários projetos o CNPJ no `config`/seed é fictício, só placeholder)
2. **Inscrição Estadual (IE) ativa** na SEFAZ do estado
3. **Credenciamento como emissor de NFC-e** na SEFAZ + solicitação do **CSC** (Código de Segurança do Contribuinte)
4. **Certificado digital ICP-Brasil** com o CNPJ da empresa:
   - **A1** — fica no servidor, validade 12 meses, melhor pra automação via API (recomendado)
   - **A3** — token/cartão físico, validade até 36 meses, mais burocrático de automatizar

Sem isso, nenhuma integração técnica emite nota válida — é sempre o primeiro bloqueio a resolver com o cliente/contador antes de cotar o trabalho de dev.

---

## 🔌 Caminho técnico recomendado

Não vale a pena implementar comunicação direta com a SEFAZ (assinatura de XML, contingência SVC, homologação própria) — usar um **provedor intermediário via API REST** que abstrai isso.

| Provedor | Plano de entrada | Notas incluídas | Excedente | Observação |
|---|---|---|---|---|
| **Focus NFe** | R$ 59,90/mês | 500 NFC-e + 100 NF-e | R$ 0,05/NFC-e extra | Sem setup, sem fidelidade, teste grátis 30 dias — melhor custo/benefício pra volume de loja física |
| **Focus NFe (Retail+)** | R$ 629,90/mês | 9.000 NFC-e + 1.000 NF-e | R$ 0,06/NFC-e extra | Multi-CNPJ — faria sentido se centralizarmos vários clientes numa conta só |
| **eNotas** | R$ 137/mês (Básico, até 50 notas) | — | Plus (R$ 247/mês) libera API REST | Mais caro pro volume baixo, foco maior em NFS-e (serviço) |
| **PlugNotas (TecnoSpeed)** | Sob consulta | — | — | API REST/JSON, mais voltado pra integração com ERPs maiores |

**Recomendação:** Focus NFe, plano Retail — mais barato, sem fidelidade, dá pra testar de graça antes de comprometer um cliente.

### Onde entra no fluxo de cada ERP

1. Depois do pedido confirmado (`POST /pedidos` ou equivalente), backend chama a API do provedor com itens/valores/pagamentos
2. Guardar `id`/chave de acesso da NFC-e retornada + status (autorizada / rejeitada / contingência)
3. Cupom de venda passa a imprimir o **DANFE-NFCe** (com QR Code de consulta) em vez do comprovante não-fiscal
4. Tratar rejeição da SEFAZ (dados divergentes, IE irregular) e modo de contingência (SEFAZ fora do ar)

Esse desenho é genérico o suficiente pra plugar em qualquer um dos PDVs Core (`thieco-caixa`, `villamill-pdv`, `ivsstore-erp`, `orbita-lobo`, `orbita-whitelabel`) — a integração com o provedor fiscal seria um módulo compartilhável, não precisa reinventar por cliente.

---

## Próximos passos

1. Por cliente: confirmar com contador se CNPJ/IE já estão regularizados e se o prazo de SP já está vencido pra eles
2. Definir se a integração com o provedor fiscal vira um **módulo próprio do ecossistema** (reaproveitável entre PDVs) ou é feita ad-hoc por cliente
3. Só depois disso, cotar/implementar por cliente

**Status:** levantamento concluído, sem implementação iniciada em nenhum projeto. Depósito Lobo foi o gatilho da pesquisa (2026-07).
