💼 2. Portfólio de Produtos e Estrutura de Preços
O ecossistema divide-se em duas camadas: Sistemas de Gestão Core (ERPs) e Módulos de Comunicação (Órbita).

A. Sistemas de Gestão (Core ERP)

Villa Mill (Restaurante): Licenciamento ativo de R$ 350,00/mês. PDV full-stack (Next.js 15), controle de mesas, controle de insumos e módulo integrado de parceria/caixinha com lava-rápido.

Thieco (Barbearia): Sistema estável (React/Node.js) com controle de caixa multi-unidades, regras automáticas de taxas PagBank e cálculo de comissões (40% serviço / 10% produto).

IVSSTORE (Varejo/Moda): ERP com parse automático de XML de NF-e via fast-xml-parser, controle de lotes/validade para perfumaria e controle de saldo devedor de fiado (vencimentos dias 15/30).

B. Camada de Automação e Comunicação (Módulos Órbita)

Módulos integrados de WhatsApp via Evolution API. Podem atuar de forma Passiva (Agentes de atendimento/IA com OpenRouter) ou Ativa (Disparos automáticos e alertas gerados por eventos dos ERPs).

Nível
 
01-Nome do Agente: Órbita Horizon
Escopo Técnico de Entrega: "Atendimento receptivo inteligente, tira-dúvidas (FAQ) 24/7 e triagem inicial com transbordo para painel CRM."
Setup (Único): R$ 997,00
Mensalidade: R$ 497,00

02-Órbita Pulsar,"Qualificação profunda de leads + Módulo Ativo de Disparos (Alertas sistêmicos, cobrança de fiado com saldo e chave Pix automática).","R$ 1.497,00","R$ 597,00"

03-Órbita Quasar,Tudo do Nível 02 + Agendamento autônomo conectado em tempo real com Google Calendar / Agendas internas.,"R$ 2.497,00","R$ 697,00"


##  Engenharia de Prompt e Escopo de Cada Robô

### Nível 01: Órbita Horizon (Recepção & FAQ)

Este modelo é puramente **receptivo**. O foco dele é gastar o mínimo de tokens possível com respostas rápidas e precisas.

- **Modelo no OpenRouter:** `anthropic/claude-3-haiku` (Velocidade absurda, custo quase zero e excelente para seguir instruções de FAQ).
    
- **Estrutura do Prompt (`system_prompt.txt`):**
    
    - **Role:** Você é o atendente virtual da empresa X. Seu tom de voz é amigável, direto e profissional.
        
    - **Contexto (FAQ):** [Inserir aqui a tabela de preços, horários de funcionamento, regras de entrega e dúvidas comuns do cliente].
        
    - **Regra de Transbordo:** Se o usuário solicitar falar com um atendente humano, use uma palavra-chave reservada no JSON de resposta (ex: `{"action": "transfer"}`) para que o FastAPI desative o bot temporariamente e direcione para o painel de atendimento humano.
        

###  Nível 02: Órbita Pulsar (Qualificação & Disparos Ativos)

Este modelo une a inteligência conversacional (receptiva) com **ações automáticas baseadas em eventos** (ativa).

- **Modelo no OpenRouter:** `anthropic/claude-3.5-sonnet` ou `anthropic/claude-3-haiku` (dependendo da complexidade das regras de qualificação).
    
- **Camada Ativa (`triggers.py`):**
    
    - O robô possui um endpoint no FastAPI (ex: `/api/v1/disparos`) pronto para receber webhooks de sistemas como Hotmart, Kiwify ou do seu próprio ERP da loja **IVSSTORE**.
        
    - **Lógica de Cobrança (Exemplo IVSSTORE):** Quando o ERP avisa que o cliente está com o fiado vencido, o script dispara uma mensagem direta puxando os valores do banco de dados: _"Olá [Nome], identificamos que o seu saldo pendente para o dia 15 é de R$ [Valor]. Segue nossa chave Pix..."_
        
- **Camada Passiva (Qualificação):** O prompt orienta o Claude a extrair dados específicos do lead (como nome, e-mail, faturamento ou dor principal) durante a conversa. À medida que o cliente responde, o robô valida as informações estruturadas em background.
    

###  Nível 03: Órbita Quasar (Concierge & Agendamento Avançado)

Este é o nível mais completo de engenharia. O robô utiliza a função de **Function Calling / Tool Use** do Claude para tomar ações em sistemas externos enquanto conversa.

- **Modelo no OpenRouter:** `anthropic/claude-3.5-sonnet` (Obrigatório devido à alta capacidade de raciocínio lógico e execução estável de ferramentas).
    
- **Módulo de Integração (`tools/calendar.py`):**
    
    - O Claude recebe acesso a funções Python reais mapeadas no código. Exemplo: `check_availability(data, hora)` e `book_appointment(nome, email, data, hora)`.
        
- **Fluxo de Conversa:**
    
    1. O cliente diz: _"Gostaria de agendar uma aula experimental para amanhã à tarde."_
        
    2. O Claude, de forma autônoma, decide executar a ferramenta `check_availability` para verificar os horários livres no Google Calendar.
        
    3. O robô processa o retorno do script Python e responde para o usuário: _"Tenho disponível às 14h e às 16h. Qual fica melhor para você?"_
        
    4. Assim que o usuário confirma, o Claude aciona a ferramenta `book_appointment`, que faz o registro definitivo na agenda em tempo real, sem intervenção humana.
        

###  Governança de Custos no OpenRouter

Ao rodar esse modelo de código puro, você gerencia os limites de gastos configurando uma única chave de API (`API_KEY`) no OpenRouter para toda a sua operação. Dentro do painel do OpenRouter, você consegue rastrear o consumo exato por modelo e definir alertas de teto de gastos. Com isso, os seus custos ficam fixos e previsíveis, mantendo sua margem de lucro operacional intacta.


