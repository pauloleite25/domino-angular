# Projeto Domino Angular

Este projeto e um jogo de domino feito em Angular, com suporte a partida local contra bots e partida online simples por sala na rede/local ou em deploy.

O jogo usa quatro posicoes fixas: `A`, `B`, `C` e `D`. As duplas sao:

- Time `AC`: jogadores `A` e `C`.
- Time `BD`: jogadores `B` e `D`.

## Como Rodar

Para desenvolvimento com Angular e servidor de salas juntos:

```bash
npm run dev
```

Esse comando sobe:

- Angular em `http://localhost:4200`.
- Servidor de salas em `http://localhost:4310`.

Para gerar build de producao:

```bash
npm run build
```

Para rodar o servidor que serve o build:

```bash
npm start
```

## Hardening recente

As ultimas correcoes de seguranca trataram os principais pontos do fluxo online casual:

- o frontend nao aceita mais `apiBase` arbitrario vindo da URL ou de `localStorage`; agora so usa origens confiaveis
- a `session_key` nao fica mais exposta na URL da pagina
- a `session_key` do modo online fica em `sessionStorage` por aba, com limpeza quando a sessao perde validade ou o jogador sai da sala
- o WebSocket nao envia mais `session_key` na URL; a autenticacao agora acontece pela primeira mensagem `auth`
- mensagens de erro mostradas ao usuario passaram a ser controladas no frontend, sem repassar `detail` bruto da API
- logs de rede do multiplayer ficaram restritos ao modo de desenvolvimento

Arquivos principais dessas correcoes:

- `src/app/features/game/services/network-api-base.util.ts`
- `src/app/features/game/services/backend-session-storage.util.ts`
- `src/app/features/game/services/match-facade.service.ts`
- `src/app/features/game/components/local-match-screen/local-match-screen.component.ts`

O contrato correspondente do backend realtime foi documentado em `../backend-domino/BACKEND_DOMINO.md`.

## O Que O Jogo Faz

O projeto permite:

- Jogar domino com quatro posicoes fixas na mesa.
- Jogar sozinho contra CPUs.
- Criar uma sala com nome e senha.
- Entrar em uma sala escolhendo a posicao `B`, `C` ou `D`.
- Jogar com ate quatro jogadores humanos.
- Usar bots nas posicoes que nao forem ocupadas por humanos.
- Jogar no celular em orientacao horizontal.
- Ver placar, historico de jogadas e popup de galo.

## Estrutura Principal

### Frontend Angular

Codigo principal:

- `src/app/features/game/components/local-match-screen/`
  Tela principal da partida, sala, mao do jogador, mesa e controles.

- `src/app/features/game/components/domino-board/`
  Renderizacao da mesa, pedras jogadas e nomes dos jogadores ao redor do tabuleiro.

- `src/app/features/game/components/player-hand/`
  Renderizacao das pedras da mao do jogador humano.

- `src/app/features/game/services/local-match.service.ts`
  Estado da partida, turnos, bots, pontuacao, sincronizacao de sala e snapshot.

### Engine do Domino

Codigo das regras puras:

- `src/app/core/domino/rules.ts`
  Regras de mesa, pontas, encaixe e abertura.

- `src/app/core/domino/moves.ts`
  Jogadas legais.

- `src/app/core/domino/scoring.ts`
  Pontuacao.

- `src/app/core/domino/setup.ts`
  Criacao e distribuicao das pecas.

- `src/app/core/domino/bot.ts`
  Escolha de jogadas da CPU.

### Servidor de Salas

Arquivo:

- `scripts/lan-duo-server.mjs`

Esse servidor Node guarda as salas em memoria. Ele nao usa banco de dados.

As salas ficam neste `Map`:

```js
const rooms = new Map();
```

Cada sala guarda:

- senha;
- jogadores humanos;
- nomes dos jogadores;
- posicoes ocupadas;
- snapshot da partida;
- comandos enviados pelos convidados.

Se o servidor for reiniciado, todas as salas somem.

## Regras da Partida

### Pecas

O jogo usa domino tradicional de `0` a `6`, totalizando 28 pecas.

Cada jogador recebe 7 pecas.

### Redistribuicao

Se algum jogador receber 5 ou mais carrocas, a rodada precisa ser redistribuida.

Essa regra fica em:

```ts
REDISTRIBUTION_CARROCA_THRESHOLD = 5
```

Arquivo:

```txt
src/app/core/domino/constants.ts
```

### Ordem dos Jogadores

A ordem fixa dos turnos e:

```txt
A -> B -> C -> D -> A
```

### Times

```txt
A + C = time AC
B + D = time BD
```

### Abertura da Mesa

A rodada inicia com uma carroca.

A primeira peca da mesa precisa ser uma carroca. Quando a mesa abre, as quatro pontas ficam disponiveis, mas o eixo permitido depende de quem abriu.

Se quem abriu foi `A` ou `C`, o eixo primario e:

```txt
north / south
```

Se quem abriu foi `B` ou `D`, o eixo primario e:

```txt
west / east
```

O eixo secundario so libera depois que as duas pontas do eixo primario tiverem pelo menos uma peca.

## Pontuacao

### Pontos da Mesa

Depois de uma jogada, o jogo soma as pontas abertas da mesa.

Se a soma for multiplo de 5, o time do jogador que jogou ganha essa quantidade de pontos.

Exemplo:

```txt
Pontas abertas = 10
Time do jogador ganha 10 pontos
```

Se a soma nao for multiplo de 5, nao pontua.

### Carroca na Ponta

Quando a ponta aberta e uma carroca, o valor dela conta dobrado.

Exemplo:

```txt
Ponta 6-6 vale 12
```

### Passe

Quando um jogador passa logo apos uma jogada, existe penalidade de passe:

```txt
20 pontos
```

Esses pontos vao para o time adversario de quem passou.

Passes consecutivos depois disso nao repetem a mesma penalidade.

### Galo

Galo acontece quando:

1. Um jogador faz uma jogada.
2. Os outros tres jogadores passam.
3. O mesmo jogador consegue jogar novamente.

Quando isso acontece, o jogador ganha:

```txt
+50 pontos
```

O popup de galo aparece na tela, e o historico registra a pontuacao da jogada.

### Batida

Quando um jogador acaba as pecas, a rodada termina por batida.

O time vencedor recebe os pontos calculados pelas pecas restantes do time adversario, arredondando para baixo ate o multiplo de 5 mais proximo.

Exemplo:

```txt
Soma adversaria = 24
Pontua = 20
```

### Batida de Carroca

Se a ultima peca jogada na batida for uma carroca, soma bonus:

```txt
+20 pontos
```

### Rodada Travada

Se a rodada travar, o jogo soma as pecas dos times:

- Se `AC` tiver menos pontos na mao, `AC` vence.
- Se `BD` tiver menos pontos na mao, `BD` vence.
- Se empatar, ninguem pontua.

A pontuacao da rodada travada e a diferenca entre os times, arredondada para baixo ate o multiplo de 5.

## Bots

As CPUs jogam automaticamente quando a posicao nao esta ocupada por humano.

O delay atual da CPU e:

```txt
2 segundos
```

Arquivo:

```txt
src/app/features/game/services/local-match.service.ts
```

Constante:

```ts
BOT_MOVE_DELAY_MS = 2000
```

### Como A CPU Decide

A CPU avalia jogadas legais e monta uma pontuacao estrategica considerando:

- pontos imediatos que a jogada faz;
- chance de fazer 50 pontos de galo;
- reducao das jogadas do proximo adversario;
- protecao do parceiro;
- quantidade de jogadas futuras que ela mesma tera;
- quantidade de valores em aberto que ainda combinam com sua mao;
- risco de dar uma boa resposta para o adversario;
- prioridade de lado da mesa;
- valor total da peca.

A CPU escolhe a jogada com melhor pontuacao calculada.

Arquivo:

```txt
src/app/core/domino/bot.ts
```

## Salas Online

### Criar Sala

O jogador que cria a sala vira a posicao `A`.

Ele informa:

- nome da sala;
- senha;
- nome do jogador.

### Entrar Na Sala

Quem entra informa:

- nome;
- nome da sala;
- senha;
- posicao desejada: `B`, `C` ou `D`.

### Inicio Da Partida

A partida deve comecar quando houver jogadores humanos suficientes na sala.

As posicoes nao ocupadas por humanos ficam como CPU.

### Onde Os Dados Da Sala Sao Salvos

Os dados ficam em memoria no servidor Node:

```js
const rooms = new Map();
```

Dentro de cada sala, os nomes ficam em:

```js
room.playerNames
```

Exemplo:

```js
{
  A: "PC",
  B: "Joao",
  C: "Maria"
}
```

Os humanos ficam em:

```js
room.humanPlayers
```

Exemplo:

```js
["A", "B", "C"]
```

As posicoes ocupadas ficam em:

```js
room.occupiedRoles
```

## Sincronizacao Online

O host da sala controla o estado principal da partida.

O servidor guarda um `snapshot` com o estado atual:

```js
room.snapshot
```

Os convidados:

- recebem snapshots do servidor;
- mandam comandos de jogada para o servidor;
- o host le esses comandos;
- o host aplica a jogada e publica novo snapshot.

Endpoints principais:

```txt
POST /rooms
GET /rooms/:room
POST /rooms/:room/join
GET /rooms/:room/snapshot
POST /rooms/:room/snapshot
GET /rooms/:room/commands
POST /rooms/:room/commands
```

## Layout Da Mesa

O layout visual da mesa fica em:

```txt
src/app/features/game/model/board-layout.ts
```

Regras atuais do layout:

- o galho tem no maximo 3 pecas antes de mudar de direcao;
- ao trocar direcao, a nova peca deve ficar ao lado da anterior;
- o tabuleiro tenta usar o maximo possivel do espaco disponivel;
- no mobile, o jogo prioriza orientacao horizontal.

## Mobile

No mobile:

- a interface pede para girar o celular;
- a mao do jogador fica na parte inferior;
- o placar fica compacto;
- os nomes dos jogadores ficam ao redor do tabuleiro;
- jogadores laterais ficam com nome na vertical;
- jogadores de cima e baixo ficam com nome na horizontal.

## Comandos Uteis

Rodar tudo em desenvolvimento:

```bash
npm run dev
```

Rodar somente Angular:

```bash
npm run dev:angular
```

Rodar somente servidor de salas:

```bash
npm run lan-duo
```

Build:

```bash
npm run build
```

Testes:

```bash
npm test
```

## Observacoes Importantes

- As salas nao persistem depois que o servidor reinicia.
- Nao existe banco de dados atualmente.
- O servidor de salas atual e simples e guarda tudo em memoria.
- Para deploy em Render, o servidor Node deve servir o build Angular e as rotas de sala.
- Para testar mudancas em sala online, sempre reinicie o servidor e crie uma sala nova.
