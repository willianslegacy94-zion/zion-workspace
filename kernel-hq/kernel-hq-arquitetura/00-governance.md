# 🏛️ Governança Geral, Arquitetura e Modelo de Negócios — Ecossistema Willians

Este documento centraliza a governança corporativa, a arquitetura técnica de microsserviços, o portfólio de produtos (ERPs Core e Inteligência Artificial) e delimita com precisão jurídica as fronteiras da sociedade comercial.

> **Documentação estruturada:** consulte `00-governance/ecosystem-guide.md` para o mapa completo e atualizado de todos os sistemas do ecossistema.

---

## 📂 1. Estrutura de Diretórios e Infraestrutura VPS (Hostinger)

Toda a operação é conteinerizada via Docker no servidor VPS (Plano KVM 2 - 8GB RAM / 2 vCPU). O ecossistema utiliza `Docker Volumes (Bind Mounts)` para garantir persistência absoluta de dados e facilitar atualizações via LLMs.

```text
/home/willians_corp/
├── docker-compose.yml              # Proxy reverso global (Nginx) e redes internas
│
├── 🏪 core-apps/                   # [PROPRIEDADE 100% WILLIANS] ERPs Web Proprietários
│   ├── villamill-pdv/              # Next.js 15 (Standalone) + PostgreSQL 16 (Restaurante — Ativo)
│   ├── thieco-caixa/               # React 18 + Node.js/Express + PostgreSQL 16 (Barbearia — Ativo)
│   ├── ivsstore-erp/               # React + Node.js + PostgreSQL (Vestuário/Perfumaria — MVP local)
│   └── orbita-whitelabel/          # React + Node.js + PostgreSQL (Caixa SaaS multi-tenant)
│
└── 🌌 kernel-hq/                # [BRAÇO DE IA & AUTOMAÇÃO — Holding de Robôs]
    ├── docker-compose.yml          # Instâncias dedicadas da Evolution API + Webhooks
    │
    ├── orbita-cortex/              # Cérebro analítico central — Python + FastAPI + SQLite
    │   └── app/main.py             # Motor de ingestão, classificação IA e sync de flags
    │
    ├── orbita-horizon/             # Agente suporte EAD multi-tenant — Python + FastAPI
    │   └── app/main.py             # Claude 3 Haiku | validação de aluno | transbordo CRM
    │
    ├── orbita-pulsar/              # Agente atendimento + disparos PMEs — Python + FastAPI
    │   └── app/main.py             # Claude 3.5 Sonnet | qualificação de leads | disparos ativos
    │
    ├── orbita-quasar/              # Concierge alto ticket — Python + FastAPI (em dev)
    │   └── app/main.py             # Claude 3.5 Sonnet | agendamento autônomo | fechamento comercial
    │
    ├── orbita-insight/             # Engine BI preditivo SaaS — Python + FastAPI
    │   └── app/main.py             # Classificação comportamental + insights via IA
    │
    └── orbita-prospeccao/          # Motor ativo de prospecção — Python + FastAPI
        ├── app/main.py             # Fila de leads | disparos em lote | classificação de resposta
        └── database.db             # SQLite — 1829 leads carregados
```

---

# Contrato de Prestação de Serviços de Tecnologia, Licenciamento de Software e Automação

**CONTRATADA:** KERNEL TECNOLOGIA, neste ato representada por seu titular/sócio administrador Willians Santana, doravante denominada simplesmente **CONTRATADA**.

**CONTRATANTE:** [Razão Social / Nome Completo do Cliente], inscrito no CNPJ/CPF sob o nº _________________, neste ato representado por _________________, portador do RG nº _________________ e CPF nº _________________, com sede/endereço em _________________, doravante denominada **CONTRATANTE**.

As partes acima identificadas têm, entre si, justo e acertado o presente Contrato de Prestação de Serviços de Tecnologia, que se regerá pelas cláusulas seguintes:

---

### Cláusula Primeira — Do Objeto e Definições
1.1. O presente contrato tem por objeto a prestação de serviços de tecnologia da informação, consistente no licenciamento temporário de sistemas, provimento de infraestrutura de comunicação e automação de processos lógicos.
1.2. Para fins deste contrato, definem-se os seguintes componentes tecnológicos que poderão integrar a entrega, conforme o plano elegível:
* **a) ERP (Enterprise Resource Planning):** Sistema central de retaguarda e gestão, responsável pelo controle de estoque, banco de dados, fluxo financeiro, processamento de documentos lógicos (como XML de NF-e) e inteligência de negócios.
* **b) PDV (Ponto de Venda):** Sistema de frente de caixa e interface operacional para registro rápido de vendas, comandos, controle de mesas ou atendimentos diretos em tempo real.
* **c) Módulos Órbita:** Camada de automação integrada via API (WhatsApp) para execução de atendimentos receptivos (IA conversacional) ou disparos ativos sistêmicos (alertas, cobranças, notificações) baseados em gatilhos e eventos do banco de dados.

---

### Cláusula Segunda — Dos Níveis de Serviço e Planos
2.1. O escopo específico das automações, módulos (ERP/PDV) e fluxos obedecerá ao plano selecionado pela CONTRATANTE no ato da assinatura, classificados da seguinte forma:
* **Órbita Horizon (Nível 01):** Atendimento receptivo inteligente via WhatsApp, resposta a dúvidas frequentes (FAQ) 24 horas por dia, 7 dias por semana, triagem e qualificação básica com direcionamento para painel de atendimento humano e/ou acesso aos módulos básicos de PDV/Caixa.
* **Órbita Pulsar (Nível 02):** Todo o escopo do Nível 01, acrescido de gestão avançada de retaguarda (ERP), sincronização de dados cadastrais e **Módulo Ativo de Disparos Sistêmicos** (envio automático de alertas de vencimento, abandono de carrinho, recuperação de mensalidades, saldos devedores de fiado ou mensagens ativas pré-programadas baseadas em gatilhos do sistema).
* **Órbita Quasar (Nível 03):** Todo o escopo do Nível 02, integrado com módulos avançados de agendamento e marcação autônoma de horários, consultas ou mentorias em tempo real integrada à API do Google Calendar ou calendários lógicos internos.

---

### Cláusula Terceira — Das Obrigações da Contratada
3.1. São obrigações da CONTRATADA:
* a) Configurar o ambiente técnico dedicado da CONTRATANTE em servidores virtuais privados (VPS);
* b) Garantir a integração técnica do fluxo de dados e o funcionamento estável do software, PDV ou motor de inteligência artificial contratado;
* c) Prestar suporte técnico remoto para correção de instabilidades ou anomalias no software licenciado em dias úteis das 09h às 18h.

---

### Cláusula Quarta — Das Obrigações da Contratante
4.1. São obrigações da CONTRATANTE:
* a) Disponibilizar todos os insumos de texto, regras de negócio, tabelas de preço, materiais institucionais e prompts de orientação que alimentarão a base de conhecimento do sistema;
* b) Disponibilizar o chip de WhatsApp dedicado e o aparelho celular conectado para a leitura inicial do QR Code da API de comunicação, quando houver o módulo de disparo;
* c) Utilizar as ferramentas em estrita conformidade com as diretrizes legais e políticas de uso oficial das plataformas parceiras (como a Meta), eximindo a CONTRATADA de qualquer responsabilidade por bloqueios, banimentos ou suspensões de contas decorrentes de práticas consideradas abusivas ou spam pelo algoritmo de terceiros.

---

### Cláusula Quinta — Dos Valores e Forma de Pagamento
5.1. Pelos serviços contratados, a CONTRATANTE pagará à CONTRATADA os valores descritos no plano de adesão eleito:
* **TAXA DE SETUP / IMPLANTAÇÃO:** Valor fixo de R$ _______________, pago em parcela única na assinatura do presente instrumento, destinado à engenharia de prompts, estruturação de fluxos, modelagem de banco de dados e configuração dos microsserviços em Docker.
* **MENSALIDADE RECORRENTE:** Valor mensal de R$ _______________, com vencimento programado para todo dia ____ de cada mês, referente à licença de uso do software (ERP/PDV/IA), processamento em nuvem e suporte técnico contínuo.
5.2. O atraso no pagamento das mensalidades superior a 5 (cinco) dias ensejará a suspensão automática dos serviços e desligamento temporário das instâncias de software e inteligência artificial no servidor, sendo reativados apenas após a quitação dos débitos acumulados acrescidos de multa de 2% e juros de 1% ao mês.

---

### Cláusula Sexta — Da Proteção de Dados (LGPD) e Segurança
6.1. As Partes declaram que cumprem integralmente a Lei Geral de Proteção de Dados (Lei nº 13.709/18). A CONTRATADA atuará estritamente na condição de **Operadora dos dados**, processando o histórico de mensagens e informações cadastrais unicamente sob a ordem e o interesse da CONTRATANTE (Controladora).
6.2. **SEGURANÇA CORPORATIVA:** A CONTRATADA garante que os dados dos clientes e bancos de dados lógicos são isolados de forma estrita em containers Docker na rede do servidor, com tráfego protegido e portas padrão de bancos de dados fechadas para acesso externo.

---

### Cláusula Sétima — Da Vigência, Fidelidade e Rescisão
7.1. O presente contrato é firmado pelo prazo de vigência de **12 (doze) meses**, contados a partir da data de sua assinatura, possuindo um período de **fidelidade mínima obrigatória de 06 (seis) meses**.
7.2. Após o cumprimento do período de fidelidade mínima de 06 (seis) meses, qualquer das partes poderá rescindir o presente instrumento sem a aplicação de penalidades, desde que notifique a outra parte formalmente por escrito (via e-mail ou WhatsApp corporativo) com antecedência mínima de **30 (trinta) dias** do próximo vencimento.
7.3. **DA MULTA RESCISÓRIA POR QUEBRA DE FIDELIDADE:** Caso a CONTRATANTE solicite a rescisão antecipada do contrato ou dê causa à sua extinção antes de integralmente cumprido o período de fidelidade mínima (primeiros 06 meses), ficará obrigada ao pagamento imediato à CONTRATADA de uma multa penal compensatória equivalente a **50% (cinquenta por cento) do valor total das mensalidades vincendas** que restarem para