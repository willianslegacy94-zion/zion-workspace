# TeloVis Space

Escritório virtual 2D em pixel art com áudio/vídeo por proximidade.
Spec: `ESCOPO TÉCNICO E ARQUITETURA DE SOFTWARE — TELOVIS SPACE`.

## Estrutura

```
telovis-space/
├── packages/protocol/        # tipos dos eventos Socket.io (fonte única, web + realtime)
├── apps/realtime/            # servidor Node + Socket.io (posições) + emissão de token LiveKit
│   └── src/
│       ├── index.ts          # conexão, room:join, player:move, disconnect
│       ├── rooms.ts          # estado em memória por space
│       ├── auth.ts           # valida o ticket do handshake (io.use)
│       ├── internal.ts       # POST /internal/events (Next → realtime)
│       ├── validation.ts     # validação dos payloads do cliente
│       └── livekit.ts        # token LiveKit com identity = socket.id
└── apps/web/                 # Next.js 16 (App Router) + Phaser + Tailwind v4
    ├── prisma/schema.prisma  # User, Session, Space, SpaceMember (spec, seção 5)
    ├── prisma/seed.ts        # space "hq" + contas de teste
    ├── public/assets/        # mapa Tiled + tileset placeholder do space "demo"
    ├── scripts/generate-placeholder-assets.mjs
    └── src/
        ├── app/
        │   ├── page.tsx                          # /  (landing + lista de spaces)
        │   ├── login/, signup/                   # formulários de conta
        │   ├── actions.ts                        # signup, login, logout (Server Actions)
        │   ├── api/realtime-ticket/route.ts      # emite o ticket do Socket.io
        │   ├── dashboard/page.tsx                # /dashboard: seus spaces + criar space
        │   ├── dashboard/[slug]/page.tsx         # gestão de membros (só ADMIN)
        │   ├── dashboard/actions.ts              # createSpace, addMember, updateMemberRole, removeMember
        │   └── space/[spaceId]/
        │       ├── page.tsx                      # /space/[spaceId]
        │       └── customizer/page.tsx           # editor de avatar
        ├── components/space/
        │   ├── SpaceClient.tsx   # client component: socket, mídia, HUD, next/dynamic ssr:false
        │   └── PhaserGame.tsx    # monta/destrói o Phaser.Game (só no cliente)
        ├── game/
        │   ├── scenes/OfficeScene.ts  # WASD, colisão, rede, proximidade
        │   └── zones.ts               # zonas privadas da camada `zones` do Tiled
        └── lib/
            ├── auth/                  # senha (scrypt), sessão (cookie + tabela), ticket JWT
            ├── realtime/notify.ts     # avisa o realtime de mudanças no banco
            ├── proximity/proximity.ts # algoritmo distância → ativar/mutar + volume
            ├── media/media-controller.ts # aplica as decisões no LiveKit
            └── space/                 # socket client, resolução e acesso ao space
```

## Rodando

```bash
npm install
docker compose up -d                 # Postgres em :5450
cp apps/web/.env.example apps/web/.env
cp apps/realtime/.env.example apps/realtime/.env
# preencha REALTIME_TICKET_SECRET com o MESMO valor nos dois .env
npm run prisma:migrate -w @telovis/web
npm run prisma:seed -w @telovis/web
npm run dev          # web em :3000, realtime em :4000
```

Contas do seed (senha `telovis123`): `admin@telovis.local` (dono do `hq`),
`ana@telovis.local` (membro do `hq`) e `bruno@telovis.local` (sem vínculo, só
entra no `demo`). Entre com duas delas em navegadores/janelas anônimas
diferentes e abra `/space/hq`. Sem as
variáveis `LIVEKIT_*` o servidor sincroniza só posição (a HUD avisa); com elas,
a mídia liga e desliga conforme a proximidade.

Testes do algoritmo de proximidade: `npm test`.

## Autenticação

- **Conta**: e-mail + senha (`scrypt` do Node), sessão numa tabela `Session`
  com cookie httpOnly de 30 dias. O banco guarda só o SHA-256 do token.
- **Acesso a um space**: dono (`Space.ownerId`) entra como ADMIN; senão precisa
  de linha em `SpaceMember`. O `demo` é aberto a qualquer usuário logado
  (GUEST). Sem acesso, a página responde "Sem acesso", tanto para space
  inexistente quanto para space alheio.
- **Ponte com o realtime**: a cada (re)conexão o cliente chama
  `GET /api/realtime-ticket?space=<slug>`. O Next confere sessão + vínculo e
  devolve um JWT HS256 de 60s (`sub`, `name`, `space`, `role`), que vai em
  `auth.token` no handshake. O `io.use()` do realtime valida o ticket com o
  segredo compartilhado `REALTIME_TICKET_SECRET`, sem acessar o banco. O
  `room:join` só aceita o space do ticket, e o nome exibido vem do ticket, não
  do cliente.
- **Dashboard**: qualquer usuário cria um space (mapa padrão) e vira dono.
  ADMINs adicionam pessoas por e-mail (a conta precisa existir), trocam papel e
  removem. Toda action refaz a checagem de admin: `slug` e `memberId` chegam
  como campos do formulário e não são confiáveis.
- Se o ticket é recusado (sessão expirou, vínculo removido), o socket não tenta
  de novo, a mídia é desligada e a HUD pede para recarregar.

## Fluxo

1. A cena conecta (com o ticket) e emite `room:join { spaceId, x, y }`. O ack traz o
   `selfId` (= socket.id), os jogadores já presentes e o token LiveKit.
2. A cada frame a cena lê WASD/setas, move o corpo arcade (colide com as
   camadas `walls` e `furniture`) e emite `player:move` só quando algo mudou,
   a no máximo ~15Hz. Iniciar/parar e trocar de zona saem na hora.
3. O servidor valida e retransmite `player:moved` para a sala (`volatile`
   enquanto anda, confiável na parada).
4. A cada 200ms a cena roda `decideMedia()` e o `MediaController` assina ou
   cancela as faixas de cada participante e ajusta o volume.

## Regras de proximidade

- Fora de zonas: ativa se `d ≤ 150px`, desativa só acima de `170px`
  (histerese, evita liga/desliga na borda). Volume 100% até 40px, caindo
  quadraticamente até 0 em 150px.
- Zona privada (retângulo na camada `zones` do Tiled, propriedade `zoneId`):
  se qualquer um dos dois está numa zona, a mídia só fica ativa se ambos estão
  na **mesma** zona, com volume cheio. A distância é ignorada.
- "Mutar" = cancelar a assinatura no LiveKit (o SFU para de encaminhar), não só
  zerar o volume local.
- **Chat de texto** segue a mesma regra (`canHear` em `packages/protocol`, sem
  histerese), aplicada no servidor: quem está fora do alcance nem recebe o
  pacote. A mensagem aparece em balão sobre o avatar e no painel da HUD.

## No mapa

- Avatares pixel art com 4 direções e caminhada, gerados em runtime.
  `game/avatar-draw.ts` desenha em canvas 2D puro (usado pela cena e pela
  prévia do Customizer); `game/avatar.ts` transforma em textura do Phaser.
- **Customizer** (`/space/[id]/customizer`, botão "Avatar" na HUD): pele,
  cabelo (curto/longo/careca + cor), camisa e calça. O visual é um
  `AvatarLook` de índices nas paletas de `packages/protocol` (só acrescente
  opções no fim das listas), salvo em `User.avatar`. Sem visual salvo, vale o
  padrão derivado do nome. O visual vai assinado no ticket; os colegas veem a
  mudança quando a pessoa volta ao space.
- Círculo do raio de 150px em volta de você (some dentro de zonas) e anel verde
  nos colegas cuja mídia está ativa.
- Zonas com contorno sempre visível; ao entrar, a sala acende e a HUD avisa
  "conversa privada".
- Minimapa (câmera extra do Phaser) com pontos dos jogadores e o retângulo da
  área visível.
- Enter foca o chat, Esc volta ao jogo; o avatar não anda enquanto você digita.

## Mapas do Tiled

O mapa padrão (`scripts/generate-placeholder-assets.mjs`, 50×32 tiles) tem
recepção, área de trabalho com 18 mesas, três salas de reunião privadas (Sala
Atlântico, Sala 1:1, Sala Foco), café/descanso, cozinha e garagens de kart
(recepção) e patinete (área de trabalho e café).

A cena lê estas camadas (nomes exatos; só `floor`, `walls` e `furniture` são
obrigatórias):

| Camada | Tipo | Uso |
|---|---|---|
| `floor` | tiles | piso |
| `walls`, `furniture` | tiles | qualquer tile colide |
| `decor` | tiles | cadeiras, puffs: desenhados, sem colisão |
| `zones` | retângulos com `zoneId` | salas privadas (áudio/chat só entre quem está dentro) |
| `areas` | retângulos com nome | áreas abertas (café, cozinha…): nome no chão e na HUD, áudio por proximidade |
| `desks` | retângulos 64×32 | posições de mesa; o **nome** do objeto é a chave (`mesa-01`) |
| `vehicles` | pontos `kart` / `patinete` | garagens: perto do ponto, **E** sobe no veículo |
| `objects` | ponto `spawn` | onde se nasce |

Um mapa só pode usar um tileset por enquanto.

## Mesas pessoais

- Perto da cadeira de uma mesa livre, **E** (ou clique no aviso) pega a mesa e
  abre o setup. Na sua mesa, **E** abre o setup de novo. Opções:
  - modelo: clássica, em pé (sem cadeira, com tapete) ou gamer (fita de LED);
  - telas: notebook, 1 ou 2 monitores, monitor curvo, ultrawide curvo, em
    preto ou branco;
  - tampo em 8 cores;
  - cadeira escritório, gamer ou banqueta, em 10 cores;
  - planta, caneca, luminária.
- Uma mesa por pessoa em cada space; pegar outra muda de lugar levando o setup.
  Duas pessoas na mesma mesa ao mesmo tempo: o banco (`@@unique`) desempata.
- O servidor só aceita chaves que existem na camada `desks` do mapa do space.
- Não vale no `demo` (é compartilhado) nem para convidados (GUEST).
- O admin vê e libera mesas em `/dashboard/[slug]`; quem é removido do space
  tem a mesa liberada.
- O setup é um `DeskSetup` de índices (`packages/protocol/src/desk.ts`), mesmo
  esquema do avatar. Desenho em `game/desk-draw.ts`, usado pela cena e pela
  prévia do diálogo. Campos acrescentados depois (`model`, `chairModel`,
  `screenColor`) assumem o padrão quando faltam no JSON já salvo; campo novo
  entra em `ADDED_LATER`.

## Kart e patinete

- Perto de uma vaga (placa **P**), **E** sobe no veículo; **E** de novo desce,
  em qualquer lugar. A garagem nunca esvazia.
- Kart anda a 310 px/s, patinete a 240 (a pé, 160). Colisão igual à de quem
  anda a pé.
- De veículo, mesas não entram em foco: o **E** serve só para descer.
- O veículo vai no `player:move` (`vehicle: "kart" | "patinete" | null`), então
  todo mundo vê ao vivo. Não é gravado no banco: ao recarregar, volta a pé.
- Desenho em `game/vehicle-draw.ts`: o kart cobre as pernas do avatar, o
  patinete fica por baixo.

## Mudanças ao vivo (Next → realtime)

Quando algo muda no banco e precisa valer para quem já está conectado, o Next
chama `POST /internal/events` no realtime (`lib/realtime/notify.ts`), com um JWT
de audiência `telovis-realtime-internal` assinado pelo mesmo
`REALTIME_TICKET_SECRET`. Eventos:

- `member.removed`: o realtime avisa (`session:revoked`) e derruba as conexões
  da pessoa naquele space na hora.
- `member.role`: atualiza o papel na conexão aberta.
- `avatar.updated`: troca o visual para todos (`player:updated`).
- `desk.updated`: repassa a mesa para a sala (`desk:updated`).

É melhor esforço: se o realtime estiver fora, o banco já foi gravado e o ticket
de 60s continua barrando a próxima conexão. `REALTIME_INTERNAL_URL` (no `.env`
do web) é o endereço do realtime visto pelo servidor Next.

Em desenvolvimento, a cena fica em `window.__officeScene` para testes de
navegador lerem e posicionarem o jogador.

## Pendências conhecidas

- **Auth**: sem recuperação de senha, verificação de e-mail ou rate limit no
  login. Não há limpeza periódica de sessões expiradas.
- **Escala**: estado das salas em memória (uma instância). Para várias, Redis +
  `@socket.io/redis-adapter`.
- **Dashboard**: sem convite por e-mail (só adiciona quem já tem conta), sem
  métricas de uso, sem renomear/excluir space nem transferir a posse.
- **Avatar**: `User.avatarSprite` (da spec) segue sem uso, reservado para
  spritesheets enviados.
- **Mesas**: a mesa não "senta" o avatar (ele só fica em pé na cadeira) e não há
  status de ausência ("volto já") na mesa.
- Upload de mapa e Shadcn/UI ainda não existem.
