
## 🛠️ Arquitetura Técnica Geral (O que o Claude vai criar)

Para todos os robôs, utilizaremos:

- **Linguagem:** Python (FastAPI) para ser leve e rápido.
    
- **Conector WhatsApp:** Evolution API (instalada via Docker no VPS).
    
- **Cérebro:** Claude 3.5 Sonnet via OpenRouter API.
    
- **Integração:** Webhooks das plataformas de membros.
    

## 🤖 Nível 01: Zion Informacional (Área de Membros)

O foco aqui é o suporte básico ao aluno e verificação de acesso.

- **Características:**
    
    - Verifica se o aluno tem uma compra ativa na plataforma via e-mail.
        
    - Responde dúvidas frequentes do curso (FAQ carregado no prompt da IA).
        
    - Envia o link de acesso/recuperação de senha se o aluno estiver perdido.
        
- **Modelo de Negócio:**
    
    - **Setup:** R$ 997,00.
        
    - **Mensalidade:** R$ 497,00.
        

## 🤖 Nível 02: Zion Assistente (O Tutor Digital)

Este robô não apenas responde dúvidas, mas analisa o progresso do aluno.

- **Características (Tudo do Nível 1, mais):**
    
    - **Triagem Estruturada:** Identifica em qual módulo o aluno está travado.
        
    - **Automação de Documentos:** Se o seu curso jurídico entrega modelos de petição, o robô pode enviar o PDF do modelo direto no WhatsApp.
        
    - **Qualificação:** Identifica se o aluno é um "lead" para uma mentoria mais cara (Upsell).
        
- **Modelo de Negócio:**
    
    - **Setup:** R$ 1.497,00.
        
    - **Mensalidade:** R$ 597,00.
        

## 🤖 Nível 03: Zion Autônomo (O Concierge de Mentoria)

Focado em cursos de alto ticket ou mentorias individuais.

- **Características (Tudo do Nível 2, mais):**
    
    - **Agendamento Inteligente:** Integrado ao **Google Calendar**. Se o aluno tem direito a uma call de suporte, o robô agenda sozinho.
        
    - **Suporte Comercial:** Capaz de fechar vendas de novos módulos via WhatsApp.
        
    - **Concierge:** Lembra o aluno de aulas ao vivo ou prazos de renovação de assinatura.
        
- **Modelo de Negócio:**
    
    - **Setup:** R$ 2.497,00.
        
    - **Mensalidade:** R$ 697,00.
        

## 🚀 Como começar a codar com o Claude?

Para o seu primeiro cliente (ou para o seu próprio bot), peça ao Claude o seguinte:

> "Claude, atue como um desenvolvedor Python sênior. Vamos criar o **Nível 01 da Zion Ops** para um curso na **Kiwify**. Preciso de um código em **FastAPI** que:
> 
> 1. Receba o e-mail do usuário via Webhook da Evolution API.
>     
> 2. Consulte a API da Kiwify (ou receba um webhook de venda aprovada) para validar se o usuário é aluno.
>     
> 3. Use a API do **OpenRouter** para responder dúvidas do curso com base em um TXT de contexto que eu vou fornecer.
>     
> 4. Mantenha o histórico da conversa em um banco SQLite simples no meu VPS."
>     

**Dica de Escalabilidade:** Como você terá 10 clientes, peça para o Claude criar o código de forma **multitenant** (onde o sistema identifica qual cliente está falando pelo número do WhatsApp e usa a chave de API correta).

