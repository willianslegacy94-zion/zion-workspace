
Prompt 1

Claude, quero planejar uma nova implantação no sistema [NOME]. A melhoria consiste em: [Descreva brevemente, ex: integrar uma nova API de pagamento]. Antes de começarmos, analise os arquivos `00-governance/system-rules.md` e `00-governance/operational-workflow.md`  que estão na pasta C:\Users\Willians DataMeet\Desktop\Ops\Kernel Workspace\kernel-hq\00-governance e me diga: essa implantação viola alguma regra de arquitetura ou dependência do nosso ecossistema?"
   
Prompt 2

Com o sinal verde da governança, é hora de botar os agentes para trabalhar. A melhor prática aqui é **nunca dar uma ordem genérica** (ex: _"agente, faz aí"_), mas sim usar a especialidade de cada um.

- **Agente de Arquitetura/Design:** Pede para ele desenhar o escopo técnico e documentar no Obsidian primeiro.
    
- **Claude Code (Terminal):** Executa as mudanças estruturais, cria arquivos de configuração no Ubuntu e escreve código.
    
- **Agente de Testes/Validação:** Roda os testes para garantir que a implantação não quebrou o que já existia (_regressão_).
    

> 💡 **Regra de Ouro do aiox:** Sempre peça para o agente simular ou fazer um _Dry Run_ (execução em modo de teste) antes de aplicar a mudança final no ambiente produtivo.



Prompt 3

A implantação foi concluída com sucesso. Para fechar o ciclo de boas práticas:
1. Atualize o arquivo de histórico/status do projeto (`arquitetura-villamill/status...` ou equivalente) documentando a mudança feita hoje (Maio de 2026).
2. Se essa implantação criou uma nova dependência de dados, atualize as respostas do Threshold que definimos no início.
   
   
   
Prompt 4

Se você quiser ver a "causa real" do erro direto na fonte antes de mandar para o Claude, entre no terminal da Hostinger e use o comando:

docker compose logs --tail=20 -f app