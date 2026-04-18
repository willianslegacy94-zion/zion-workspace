# 🤖 SPECIFICATION - AGENTE ZION OPS: Barbearia Thieco Leandro

## 1. Identidade e Persona
- **Nome do Agente:** Assistente Virtual Thieco Leandro.
- **Tom de Voz:** Profissional, masculino, descontraído e ágil. Usar emojis com moderação (💈, ✂️).
- **Objetivo Principal:** Filtrar dúvidas rápidas e direcionar para o link de agendamento no menor tempo possível.

## 2. Base de Conhecimento
- (Aguardando preenchimento do formulário de Onboarding pelo Thieco...)

## 3. Regras de Comportamento
- NUNCA inventar horários.
- NUNCA dar descontos.
- Respostas Curtas (máx 2 parágrafos).

## 4. Prompt do Sistema (Para colar no n8n)
- (Será gerado em breve...){
  "nodes": [
    {
      "parameters": {},
      "id": "90b6a2fc-d886-444c-ae1a-bf41c140cb7e",
      "name": "Chat Trigger",
      "type": "@n8n/n8n-nodes-langchain.chatTrigger",
      "typeVersion": 1.1,
      "position": [
        460,
        340
      ]
    },
    {
      "parameters": {
        "promptType": "define",
        "text": "={{ $json.chatInput }}",
        "options": {
          "systemMessage": "Você é o Assistente Virtual da Barbearia Thieco Leandro.\n\nAja como um recepcionista profissional, mas descontraído. \nUse emojis com moderação.\n\nSua função é tirar dúvidas rápidas e enviar o link de agendamento: https://booksy.com/\n\nNunca invente horários. Seja muito breve nas respostas (máximo 2 parágrafos curtos)."
        }
      },
      "id": "e9fb5f6e-69ba-4786-8a7e-400ef3199859",
      "name": "AI Agent (Zion)",
      "type": "@n8n/n8n-nodes-langchain.agent",
      "typeVersion": 1.6,
      "position": [
        680,
        340
      ]
    },
    {
      "parameters": {
        "model": "anthropic/claude-3.5-sonnet",
        "options": {
          "baseURL": "https://openrouter.ai/api/v1"
        }
      },
      "id": "3be5531d-b8eb-42cc-9c60-a4f664a8cb8d",
      "name": "OpenRouter (Claude 3.5)",
      "type": "@n8n/n8n-nodes-langchain.lmChatOpenAi",
      "typeVersion": 1,
      "position": [
        620,
        560
      ]
    },
    {
      "parameters": {
        "contextWindowLength": 6
      },
      "id": "50c26da4-7c2d-4530-bd11-cc2d85b19198",
      "name": "Window Buffer Memory",
      "type": "@n8n/n8n-nodes-langchain.memoryBufferWindow",
      "typeVersion": 1.2,
      "position": [
        800,
        560
      ]
    }
  ],
  "connections": {
    "Chat Trigger": {
      "main": [
        [
          {
            "node": "AI Agent (Zion)",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "OpenRouter (Claude 3.5)": {
      "ai_languageModel": [
        [
          {
            "node": "AI Agent (Zion)",
            "type": "ai_languageModel",
            "index": 0
          }
        ]
      ]
    },
    "Window Buffer Memory": {
      "ai_memory": [
        [
          {
            "node": "AI Agent (Zion)",
            "type": "ai_memory",
            "index": 0
          }
        ]
      ]
    }
  },
  "pinData": {}
}