# 🎮 Manual de Operação: Canal Dark de Games
> **Guia Definitivo de Arquitetura, Ferramentas, Workflow e Estratégia de Conteúdo**

---

## 📋 Sumário
1. [Visão Geral & Arquitetura do Canal](#1-visão-geral--arquitetura-do-canal)
2. [Stack de Ferramentas (IA + Software)](#2-stack-de-ferramentas-ia--software)
3. [Workflow Operacional Passo a Passo](#3-workflow-operacional-passo-a-passo)
4. [Engenharia de Prompts (Claude + Gemini)](#4-engenharia-de-prompts-claude--gemini)
5. [Sourcing de Mídia & Regras de Direitos Autorais](#5-sourcing-de-mídia--regras-de-direitos-autorais)
6. [Estratégia de Monetização & Diretrizes do YouTube](#6-estratégia-de-monetização--diretrizes-do-youtube)
7. [Checklist do Primeiro Vídeo](#7-checklist-do-primeiro-vídeo)

---

## 1. Visão Geral & Arquitetura do Canal

### 🎯 Proposta do Canal
Criar um ecossistema automatizado e escalável de conteúdo sobre o universo dos videogames, produzindo conteúdos de alta retenção (Shorts/Reels e Vídeos Longos) sem a necessidade de aparição pessoal (Format Dark).

### 📐 Pilares de Conteúdo
* **Últimas Notícias & Vazamentos:** Cobertura ágil sobre lançamentos, adiamentos, rumores e anúncios de grandes estúdios.
* **Histórias & Bastidores:** Documentários curtos sobre a queda de estúdios, polêmicas e curiosidades da indústria.
* **Análises de Impacto:** Vídeos focados em *"Por que [Jogo X] mudou a indústria"* ou *"O fim de [Franquia Y]"*.

---

## 2. Stack de Ferramentas (IA + Software)

Abaixo estão todas as ferramentas necessárias integradas para operação diária:

| Categoria | Ferramenta | Finalidade principal | Plano / Custo |
| :--- | :--- | :--- | :--- |
| **Pesquisa & SEO** | **Gemini (Google)** | Mapeamento de tendências em tempo real, SEO, títulos, tags e metadados. | Gratuito |
| **Roteirização** | **Claude (Anthropic)** | Escrita de roteiros longos e curtos, storytelling e adaptação de tom. | Gratuito / Pro |
| **Locução (TTS)** | **ElevenLabs** | Geração de narração ultra-realista em português com entonação humana. | Gratuito (Cota) / Pago |
| **Locução Backup** | **CapCut / TTSMaker** | Locução secundária para testes ou escassez de créditos. | Gratuito |
| **Gravação de Tela** | **OBS Studio** | Captura de gameplay própria em alta resolução. | Gratuito (Open Source) |
| **Edição de Vídeo** | **CapCut Desktop** | Montagem, sincronização de áudio, legendas automáticas e transições. | Gratuito |
| **Design de Thumbnails**| **Photopea / Canva** | Edição de imagens, composição de capas e ajuste de contraste/cores. | Gratuito |
| **Mídia de Apoio** | **IGDB.com / Press Kits** | Download de artes, assets e capturas oficiais de alta resolução. | Gratuito |

---

## 3. Workflow Operacional Passo a Passo

```
┌────────────────┐      ┌────────────────┐      ┌────────────────┐
│  1. Pesquisa   │ ───► │ 2. Roteiro IA  │ ───► │  3. Narração   │
│ (Gemini / Web) │      │    (Claude)    │      │  (ElevenLabs)  │
└────────────────┘      └────────────────┘      └────────────────┘
                                                        │
                                                        ▼
┌────────────────┐      ┌────────────────┐      ┌────────────────┐
│ 6. Publicação  │ ◄─── │ 5. Edição      │ ◄─── │ 4. Captura B-Roll│
│  (YouTube/SEO) │      │ (CapCut + Tumb)│      │  (Gameplays)   │
└────────────────┘      └────────────────┘      └────────────────┘
```

### Etapa 1: Pesquisa de Tendências (Gemini)
* Buscar notícias quentes em portais como IGN, VGC, Eurogamer ou Reddit (`r/GamingLeaksAndRumours`).
* Filtrar o gancho (hook) principal que gera curiosidade ou debate.

### Etapa 2: Roteirização (Claude)
* Transformar os fatos brutos em uma narrativa fluida.
* Garantir que os **primeiros 5 segundos** prendam a atenção imediatamente.

### Etapa 3: Geração de Áudio (ElevenLabs)
* Exportar o roteiro final para o ElevenLabs.
* Selecionar vozes com boa cadência para narrativa rápida (ex: Adam, Antoni ou vozes customizadas em PT-BR).

### Etapa 4: Coleta de Vídeos (B-Roll)
* Coletar trechos de trailers (máximo 5-7s por take).
* Utilizar gameplays gravadas no OBS Studio ou de repositórios royalty-free.

### Etapa 5: Edição e Capa (CapCut + Photopea)
* Sincronizar o áudio com as imagens no CapCut.
* Adicionar legendas dinâmicas ativas (estilo Hormozi/Shorts) e efeitos sonoros (SFX).
* Criar a capa no Photopea/Canva focada na regra dos 3 elementos (Expressão + Elemento Central + Texto Curto de Impacto).

---

## 4. Engenharia de Prompts (Claude + Gemini)

### 🤖 Prompt 1: Pesquisa de Notícias (Para o Gemini)
```text
Atue como um pesquisador especialista no mercado de games. 
Analise as últimas notícias do mundo dos videogames e me liste as 3 notícias mais relevantes das últimas 24h.
Para cada notícia, forneça:
1. Um resumo direto dos fatos (3 parágrafos).
2. O motivo pelo qual isso impacta os jogadores.
3. 3 sugestões de títulos chamativos focados em alta taxa de clique (CTR) no YouTube.
```

### 🧠 Prompt 2: Escrita do Roteiro (Para o Claude)
```text
Você é um roteirista sênior para canais dark de sucesso no YouTube sobre games.
Com base nas seguintes informações de notícia: [INSERIR INFORMAÇÕES DO GEMINI]

Escreva um roteiro completo para um vídeo de [Shorts / 3 minutos para vídeo longo].

Diretrizes obrigatórias:
- HOOK (0-5s): Comece com uma pergunta provocativa ou uma afirmação chocante. Não diga "Olá pessoal".
- DESENVOLVIMENTO: Mantenha frases curtas, tom dinâmico e focado no problema/curiosidade.
- INDICAÇÕES VISUAIS: Coloque entre colchetes [Ex: Mostrar gameplay de GTA 6] a indicação do que deve aparecer na tela em cada momento.
- CALL TO ACTION (CTA): Finalize pedindo a opinião do público nos comentários de forma natural.
```

---

## 5. Sourcing de Mídia & Regras de Direitos Autorais

Para evitar **Copyright Strike** e problemas de reivindicação de receita, siga estritamente estas diretrizes:

### ⚠️ Regras de Uso Aceitável (Fair Use)
1. **Regra dos 5 Segundos:** Não mantenha o mesmo trecho de vídeo/trailer por mais de 5 a 7 segundos sem realizar um corte ou transição.
2. **Sem Áudio Original:** Remova o áudio original dos trailers (músicas e vozes). Use apenas sua locução por IA e tramas sonoras sem copyright.
3. **Edição Transformativa:** Adicione elementos na tela (zooms, textos, overlays, filtros sutis) para transformar o material original.

### 📁 Fontes de Download Recomendadas
* **Gameplays Próprias:** Gravações pelo OBS Studio em 1080p/60fps.
* **Canais No-Copyright:** *No Copyright Gameplay*, *Royalty Free Gameplays* no YouTube.
* **Artes Oficiais:** [IGDB.com](https://www.igdb.com/) para capturas oficiais e posters em altíssima resolução.

---

## 6. Estratégia de Monetização & Diretrizes do YouTube

### 🛑 Como Evitar "Conteúdo Reutilizado" ou "Repetitivo"
O YouTube recusa monetização de canais dark que apenas juntam trechos de vídeos com voz sintética genérica. Para garantir a aprovação no Programa de Parcerias:

1. **Roteiro Original:** O texto precisa trazer valor agregado, opinião, resumo estruturado ou análise (não pode ser apenas leitura robotizada de um artigo).
2. **Edição Dinâmica:** Alterne imagens, textos na tela e efeitos gráficos.
3. **Qualidade de Voz:** Utilize vozes com entonação humana natural (ex: ElevenLabs), ajustando estabilidade e clareza.

### 💰 Fontes de Receita
* **Google AdSense:** Receita por visualizações (CPM do nicho de games varia entre $1.50 e $4.00 a cada 1.000 views).
* **Links de Afiliados:** Links na descrição para lojas (Amazon, Nuuvem, Green Man Gaming) vendendo jogos ou hardware.
* **Patrocínios Diretos:** Marcas de periféricos, cadeiras gamers e chaves de jogos após atingir audiência fiel.

---

## 7. Checklist do Primeiro Vídeo

- [ ] Pesquisa feita no Gemini com foco em tema em alta.
- [ ] Roteiro gerado no Claude com gancho nos primeiros 5 segundos.
- [ ] Áudio gerado no ElevenLabs e revisado.
- [ ] B-roll baixado ou gravado (mídia de fundo).
- [ ] Edição concluída no CapCut (com legendas dinâmicas e SFX).
- [ ] Thumbnail criada com texto grande de no máximo 3 palavras.
- [ ] Título e Metadados otimizados via Gemini.
- [ ] Publicação agendada no YouTube Studio.

---
*Manual gerado para a construção do Canal Dark de Games.*
