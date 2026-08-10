
- Como resetar e recarregar contêineres travados pelo Docker Desktop (os botões de Start/Restart).
    
- Como abrir a "porta de entrada" interativa do Postgres dentro de qualquer contêiner usando `psql -U postgres -d <nome_do_banco>`.
    
- A sintaxe padrão de redirecionamento de arquivos para o contêiner: `docker exec -i <container> psql ... < arquivo.sql`.

## Terminal Linux

cd "/mnt/c/Users/Willians DataMeet/Desktop/Ops/Kernel Workspace/sistema-thieco"

cd "/mnt/c/Users/Willians DataMeet/Desktop/Ops/Kernel Workspace/vilamill-sistema"

cd "/mnt/c/Users/Willians DataMeet/Desktop/Ops/Kernel Workspace/academia-sandro"

cd "/mnt/c/Users/Willians DataMeet/Desktop/Ops/Kernel Workspace/lanchonete-sistema"

cd "/mnt/c/Users/Willians DataMeet/Desktop/Ops/Kernel Workspace/lane-confeitaria"


## Docker

cd /var/www/vilamill-sistema

cd /var/www/sistema-thieco 

cd ~/lane-confeitaria

cd /opt/academia-sandro

cd /opt/lanchonete-sistema

CORTEX: /var/www/orbita-agents/cortex

QUASAR: /var/www/orbita-agents/quasar

---

## Portas locais — mapa central pra nunca mais colidir

Levantado em 2026-08-10 depois de um caso real (Jocley Grill e Lane Confeitaria colidiam na porta `5434` por padrão, dando erro ao subir os dois localmente ao mesmo tempo — ver `registro-de-decisoes-jocley-lanchonete.md`). Toda porta nova de Postgres/app local deve ser conferida contra esta tabela **antes** de escolher um número — nunca reaproveitar sem checar.

| Sistema | Postgres (host) | App (host) |
|---|---|---|
| `sistema-thieco` | `5432` | `5173` |
| `vilamill-sistema` | `5433` | `3000` |
| `lane-confeitaria` | `5434` | `3020` |
| `kernel` | `5435` (default, `DB_PORT_HOST`) | `80` (default, `APP_PORT`) |
| `lanchonete-sistema` (Jocley Grill) | `5436` (default, `POSTGRES_HOST_PORT`) | `3001` |
| `academia-sandro` | — (Supabase, sem Postgres local) | `3010` |
| `kernelmei` | `5438` | `3021` |
| `kernel-foodservice` | `5440` (default, `POSTGRES_HOST_PORT`) | `3011` (docker) / `3003` (dev local fora do container, `scripts/dev.js`) |
| `kernel-academia` | `5441` (default, `POSTGRES_HOST_PORT`) | `3012` |

**Faixas livres pra próximo sistema:** Postgres `5437`, `5439`, `5442+`. App `3002`, `3013+` (evitar `3000`/`3001` que já têm histórico de disputa entre projetos que rodam `next dev` sem porta fixa — ver seções de sistema individuais pra esse problema à parte, de porta de dev **não-Docker** cascateando).

**Isso resolve só a porta publicada no host pelo `docker-compose.yml`.** Não resolve o problema separado de `next dev` (fora de Docker) cascateando pra porta livre quando `3000` já está ocupada por outro projeto do workspace — esse é tratado por sistema, ver o playbook de cada um.

---

## Villa Mill Sistema (vilamill-sistema)

Conteúdo movido em 2026-08-10 para [[playbook-devops-villamill]] (`kernel-hq/arquitetura-villamill/playbook-devops-villamill.md`) — este playbook geral tinha crescido genérico demais, difícil de localizar informação por sistema.

---

## Sistema Thieco (sistema-thieco)

Conteúdo movido em 2026-08-10 para [[playbook-devops-thieco]] (`kernel-hq/arquitetura-thieco/playbook-devops-thieco.md`) — este playbook geral tinha crescido genérico demais, difícil de localizar informação por sistema.

---

## ⚠️ Risco do monorepo `Kernel Workspace` — nunca fazer `git merge`/`git pull` direto na raiz

**Descoberto em 2026-07-12, mexendo no `academia-sandro`.** O `Kernel Workspace` (a pasta que contém todos os seus projetos) é **um único repositório git** que hospeda vários sistemas independentes na mesma árvore de pastas. Pelo menos um deles na época (`orbita-lobo`, sistema descontinuado desde então) era na verdade **um repositório git próprio aninhado** (tinha seu `.git` interno, remoto separado no GitHub), vivendo como subpasta sem isolamento — sem gitlink/submodule, sem exclusão no `.gitignore` do monorepo. O risco continua válido pra qualquer repo aninhado atual (`vilamill-sistema`, `sistema-thieco`, `kernel`, `ivsstore-sistema`, `lanchonete-sistema`, `lane-confeitaria` — todos no mesmo estado hoje).

**O que aconteceu:** um `git merge origin/main` rodado direto na raiz do `Kernel Workspace` (pra publicar o `academia-sandro`) tentou reconciliar a árvore inteira do monorepo — e, ao fazer isso, **apagou 31 arquivos do disco** dentro de `orbita-lobo/` (o merge viu esses arquivos como "não deveriam existir" na árvore de fora e removeu). Recuperável (o `orbita-lobo` tem histórico próprio — `git restore .` dentro dele trouxe tudo de volta), mas podia ter sido pior se algum arquivo não estivesse commitado ali.

**Regra a seguir sempre a partir de agora, nessa pasta (`Kernel Workspace`) especificamente:**

1. **Nunca** `git merge`/`git pull`/`git checkout <branch>` direto na raiz do `Kernel Workspace` se ela tiver mudanças não commitadas em qualquer subpasta (rode `git status` primeiro e olhe a lista inteira, não só o que te interessa).
2. Pra commitar só um projeto específico, sempre limitar por pathspec — nunca `git add -A`/`git commit` genérico:
   ```bash
   git add nome-do-projeto/
   git commit -m "..." -- nome-do-projeto/
   ```
3. Pra atualizar com o remoto (merge/rebase) sem arriscar tocar em outro projeto, usar um **worktree isolado** — uma cópia de trabalho separada, só com o que já está commitado, sem os arquivos soltos de outros projetos por perto:
   ```bash
   cd "/mnt/c/Users/Willians DataMeet/Desktop/Ops/Kernel Workspace"
   git worktree add /tmp/push-temp -b temp-branch main   # cria cópia isolada em /tmp
   cd /tmp/push-temp
   git merge origin/main --no-edit                        # merge aqui dentro, sem risco pra pasta principal
   git push origin temp-branch:main                       # publica o resultado
   cd "/mnt/c/Users/Willians DataMeet/Desktop/Ops/Kernel Workspace"
   git worktree remove /tmp/push-temp --force
   git branch -D temp-branch
   ```
   Depois disso, o `main` local da pasta principal fica "atrasado" em relação ao remoto — isso é seguro (só significa que um `git pull` — feito com cuidado, ver regra 1 — resolve depois).
4. Se um merge grande (com arquivos binários tipo `.xlsx` de dezenas de MB) parecer travado, não é sempre lentidão do WSL — pode ser isso. Dar mais tempo (até uns 10min) antes de desistir; nunca rodar em background escondido (`nohup`/`disown`) só pra "não travar" — se travar, é sinal de prestar atenção, não de esconder.
5. Se descobrir outra pasta com `.git` próprio dentro do `Kernel Workspace` (`ls -la <pasta>/.git` responde em vez de dar erro), ela está no mesmo risco do `orbita-lobo` — ou soma ela ao `.gitignore` da raiz, ou formaliza como submodule, antes de fazer qualquer merge geral de novo.

---

## Sistema Órbita Whitelabel (sistema-orbita-whitelabel) — produto "Kernel"

Conteúdo movido em 2026-08-10 para [[playbook-devops-kernel]] (`kernel-hq/arquitetura-kernel/playbook-devops-kernel.md`) — este playbook geral tinha crescido genérico demais, difícil de localizar informação por sistema. Pasta local hoje é `kernel/` (renomeada de `sistema-orbita-whitelabel/`).

---

## Academia Prof. Sandro (academia-sandro)

Conteúdo movido em 2026-08-10 para [[playbook-devops-academiasandro]] (`kernel-hq/arquitetura-academiasandro/playbook-devops-academiasandro.md`) — este playbook geral tinha crescido genérico demais, difícil de localizar informação por sistema.

---

## Jocley Grill (lanchonete-sistema)

Conteúdo movido em 2026-08-10 para [[playbook-devops-jocley-lanchonete]] (`kernel-hq/arquitetura-jocley-lanchonete/playbook-devops-jocley-lanchonete.md`) — este playbook geral tinha crescido genérico demais, difícil de localizar informação por sistema.

---

## Lane Confeitaria (lane-confeitaria)

Conteúdo movido em 2026-08-10 para [[playbook-devops-lane-confeitaria]] (`kernel-hq/arquitetura-lane-confeitaria/playbook-devops-lane-confeitaria.md`) — este playbook geral tinha crescido genérico demais, difícil de localizar informação por sistema.
