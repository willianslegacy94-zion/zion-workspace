

[Idéia de Projeto] 
	 │ 
	▼
 [Claude Code valida o Threshold (6 perguntas)] ──► Reprovado? Ajusta a ideia. 
	 │
	▼ Aprovado! 
[Claude cria a estrutura de pastas automaticamente]


### Passo 1: O Prompt de Validação (Antes de codar ou criar pastas)

Antes de sair criando arquivos aleatórios, jogue a sua ideia bruta para o Claude avaliar contra a sua governança. Digite isso no Claude Code:

Estou planejando iniciar um novo projeto chamado [NOME_DO_PROJETO]. 
A ideia central dele é: [Explique aqui brevemente o que o projeto faz, ex: uma automação de relatórios financeiros].

Por favor, leia o arquivo `00-governance/operational-workflow.md` e me entreviste/avalie se este novo projeto passa no "Passo 1 — Verificar threshold". Responda às 6 perguntas com base no que eu te disse ou me pergunte o que faltar para validarmos o threshold.


### Passo 2: A Criação Automatizada (O poder do Claude Code)

Uma vez que você e o Claude responderam às 6 perguntas e o threshold foi **aprovado**, você não precisa criar as pastas na mão pelo Windows Explorer ou Obsidian. Aproveite que o Claude Code tem acesso ao terminal do Ubuntu e peça:

O threshold foi aprovado! Agora, por favor, crie a nova pasta para este projeto na raiz do workspace com o nome padrão (ex: `arquitetura-nome-do-projeto`). 

Dentro dela, crie um arquivo chamado `threshold-validation.md` contendo as 6 perguntas que respondemos e as nossas respostas consolidadas, para registrar que este sistema foi formalmente autorizado pela governança.