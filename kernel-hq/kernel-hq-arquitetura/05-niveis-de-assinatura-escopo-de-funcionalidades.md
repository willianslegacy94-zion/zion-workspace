# 08 — Níveis de Assinatura e Escopo de Funcionalidades

## Matriz de Controle de Recursos (Feature Flags)
O sistema opera sob o modelo White Label segmentado. A exibição de componentes no Frontend (`Dashboard.jsx`) e o acesso às rotas no Backend dependem do estado do JSONB `modulos_ativos` e do `plano_nivel`.
Níveis de Licenciamento

1. **Nível 1 (Essencial):** Core operacional. Módulos secundários podem ser completamente desativados/ocultados via painel de administração da Órbita a pedido do cliente.
2. **Nível 2 (Pro):** Ativa o utilitário `backend/lib/openRouter.js` focado puramente em rotinas de *cron jobs* e gatilhos de saídas de texto (Alertas operacionais via WhatsApp).
3. **Nível 3 (IA Elite):** Abre a rota bimodal de agendamento de serviços, aplicando a lógica de inteligência artificial descrita abaixo.

---

### Comportamento do Agente de Atendimento (Plano 3)
A IA de atendimento mapeia o parâmetro `tipo_agenda` nas configurações para definir o escopo de atuação no fluxo de conversão com o cliente final:

| Configuração | Fluxo da IA | Endpoint Associado |
|---|---|---|
| `interna` | Consulta horários livres e cria o registro de forma nativa. | `GET/POST /agendamentos` |
| `externa_link` | Conversa humanamente, identifica o desejo e entrega o link de agendamento do cliente. | `configuracoes.link_agenda_externo` |
| `externa_integrada` | Dispara requisição HTTP externa para sincronizar os horários em tempo real. | API Externa Cadastrada |