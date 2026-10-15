---
status: draft
domain: telovis-space
source: claude
created: 2026-10-14
updated: 2026-10-14
owner: willians
---

# UX Flows — TeloVis Space

> Referência: [[requisitos-funcionais-telovis-space]] | [[ui-kit-telovis-space]]
> **Não validado com uso real** — jornadas pretendidas, testadas só em navegador automatizado.

## 1. Dono monta o escritório

```
signup → /dashboard → criar space → /dashboard/[slug]
→ convidar e-mails (link copiado/enviado) → abrir /space/[slug]
```

## 2. Convidado entra pela primeira vez

```
link /convite/[token] → criar conta (e-mail preenchido) ou entrar
→ aceitar → /space/[slug] → permitir mic/câmera → andar até os colegas
```
Atrito conhecido: sem Resend, o dono precisa copiar o link e mandar por fora (WhatsApp).

## 3. Conversa espontânea

```
andar até um colega → ao entrar em 150px o anel verde aparece e o áudio/vídeo liga
→ falar → afastar → mídia corta acima de 170px
```
Testado em 2026-10-14 com duas contas e mídia simulada: liga perto, corta longe, religa ao voltar.

## 4. Reunião fechada

```
entrar numa sala privada (Sala Atlântico, 1:1, Foco) → sala acende, HUD avisa "conversa privada"
→ só quem está dentro se ouve e recebe o chat
```

## 5. Dia de trabalho

```
pegar mesa (E) → montar setup → sentar → status Disponível
→ sair para almoço (status) ou 5 min parado → Ausente automático
```

## Validações pendentes

- Primeiro time real usando um dia inteiro.
- Medir "tempo conversando" nas métricas como sinal da hipótese do [[prd-telovis-space]].
