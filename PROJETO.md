# Projeto Domino Angular

Este projeto e um jogo de domino feito em Angular, com suporte a partida local contra bots e partida online simples por sala na rede/local ou em deploy.

O jogo usa quatro posicoes fixas: `A`, `B`, `C` e `D`. As duplas sao:

- Time `AC`: jogadores `A` e `C`.
- Time `BD`: jogadores `B` e `D`.

## Como Rodar

Para desenvolvimento do frontend Angular:

```bash
npm run dev
```

Esse comando sobe:

- Angular em `http://localhost:4200`.

Para rodar o servidor simples de salas em separado:

```bash
npm run lan-duo
```

Esse comando sobe:

- servidor de salas em `http://localhost:4310`.

Observacao:

- hoje nao existe mais um comando unico oficial que suba frontend e servidor de salas juntos; se isso voltar a existir, a documentacao deve ser atualizada junto.

Para gerar build de producao:

```bash
npm run build
```

Para validar o pacote Android depois de mudancas visuais:

```bash
npx cap sync android
```

Observacao:

- hoje o projeto nao oferece um script oficial proprio para servir `dist/` localmente em modo producao;
- `npm start` nao valida esse fluxo, porque continua sendo apenas `ng serve`.

`npm start` hoje e apenas um alias de desenvolvimento para `ng serve`:

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

## Estado Atual Do Design

Hoje o maior problema do projeto nao esta nas regras do domino, e sim na camada visual da partida, principalmente no mobile.

Direcao visual atual:

- estilo casual premium com feltro verde, moldura de madeira escura e detalhes dourados;
- prioridade para leitura rapida da mesa e da mao do jogador;
- HUD compacto no mobile, sempre tentando preservar area util para as pedras e para o tabuleiro;
- foco principal em celular na horizontal;
- componentes desktop e mobile ainda compartilham muito CSS no mesmo arquivo, o que dificulta evolucao.

Arquivos mais importantes para design:

- `src/app/features/game/components/local-match-screen/local-match-screen.component.html`
- `src/app/features/game/components/local-match-screen/local-match-screen.component.scss`
- `src/app/features/game/components/domino-board/domino-board.component.html`
- `src/app/features/game/components/domino-board/domino-board.component.scss`
- `src/app/features/game/components/player-hand/player-hand.component.html`
- `src/app/features/game/components/player-hand/player-hand.component.scss`

Assets visuais ativos no layout atual:

- `src/assets/mes_domino_mobile.png`
  Fundo principal da mesa no mobile.

- `src/assets/suporte_mao.png`
  Base visual da mao do jogador no mobile.

Observacao importante:

- o historico/placar lateral do mobile nao depende mais de imagem dedicada; hoje ele e desenhado majoritariamente em CSS;
- assets antigos que nao aparecem mais no layout atual devem ser tratados como candidatos a limpeza antes de novos ciclos de refinamento.

Assets hoje candidatos a limpeza ou revisao de uso:

- `src/assets/historico.png`
- `src/assets/info_player_a.png`
- `src/assets/suporte_mao.webp`

## Design Da Partida No Mobile

No estado atual, a partida mobile horizontal funciona assim:

- a mesa cobre a tela inteira ao fundo;
- o `board-holder` ocupa a tela toda, atras da HUD;
- a mao do jogador fica na base, com suporte visual proprio;
- historico e placar ficam agrupados em um unico painel lateral compacto;
- as acoes principais da rodada ficam ao lado direito da mao;
- os jogadores `B`, `C` e `D` aparecem como cards compactos ao redor do tabuleiro, com quantidade de pecas representada visualmente por pecas viradas;
- o placar tradicional em coluna lateral foi substituido, no mobile, por HUD mais curta.

Arquitetura visual mobile atual:

- `mobile-bottom-row`
  Linha inferior que concentra mao e acoes do jogador humano.

- `mobile-hand-actions`
  Container dos dois botoes de acao visiveis no mobile.
  Regra atual: sempre existem apenas dois botoes visiveis por vez, com `Sair` fixo e o botao principal alternando entre `Nova partida` e `Proxima`.

- `mobile-side-panel`
  Painel compacto com historico recente e placar.

- `table-player-card`
  Cartoes dos jogadores adversarios ao redor da mesa.

## Principais Problemas De Design Hoje

Problemas mais relevantes observados no estado atual:

- a tela de partida ainda concentra responsabilidades demais em `local-match-screen.component.scss`;
- o ajuste fino do mobile esta muito sensivel a pequenos deslocamentos de largura e altura, principalmente na faixa inferior;
- o tamanho percebido das pedras depende nao so do valor base da peca, mas tambem do espaco que a HUD consome ao redor da mao;
- falta um design system leve para repetir tokens visuais de dourado, madeira, feltro, sombra, borda e raio;
- existe mistura de decisoes de layout estrutural com acabamento visual no mesmo bloco de SCSS;
- parte da HUD mobile foi refinada de forma incremental e ainda precisa consolidacao;
- o budget de estilo por componente esta perto do limite no componente principal da partida.

Limite atual de budget do Angular para estilos por componente:

```txt
warning: 30kb
error: 32kb
```

Arquivo mais pressionado hoje:

```txt
src/app/features/game/components/local-match-screen/local-match-screen.component.scss
```

## Prioridades Recomendadas De Design

Ordem sugerida para os proximos ciclos:

1. estabilizar a faixa inferior mobile: mao, acoes e painel lateral;
2. separar layout estrutural de acabamento visual no `local-match-screen.component.scss`;
3. extrair tokens visuais repetidos para variaveis globais ou blocos mais reutilizaveis;
4. revisar escala real das pedras no mobile com a HUD final, nao isoladamente;
5. consolidar um padrao unico para cards de jogador, placar, historico e botoes;
6. reduzir acoplamento entre design desktop e mobile dentro do mesmo arquivo;
7. considerar dividir a HUD mobile em componentes menores se o budget continuar crescendo.

## Regra De Trabalho Para Frontend

Sempre que houver mudanca visual relevante na partida:

- pensar primeiro no mobile horizontal;
- validar se a HUD nao rouba espaco demais da mao do jogador;
- verificar se a mesa continua visivel atras dos elementos;
- evitar reintroduzir fundos duplicados da mesa;
- preferir ajustes pequenos e reversiveis;
- rodar:

```bash
npm run build
npx cap sync android
```

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

A pontuacao da rodada travada e a soma do total do time derrotado exemplo, time AC vence total do time BD 20, logo 20 pontos para AC, arredondada para baixo ate o multiplo de 5.

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

- quantidade de jogadas futuras que ela mesma tera;
- chance de fazer 50 pontos de galo;
- reducao das jogadas do proximo adversario;
- protecao do parceiro;
- pontos imediatos que a jogada faz;
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
- a mesa usa `mes_domino_mobile.png` como fundo principal;
- a mao do jogador fica na parte inferior, com suporte proprio;
- historico e placar ficam juntos em um painel compacto lateral;
- as acoes principais do jogador ficam ao lado da mao;
- os nomes dos jogadores ficam ao redor do tabuleiro;
- jogadores laterais ficam em cards verticais;
- jogador superior fica em card horizontal;
- jogadores laterais usam pecas ocultas desenhadas na horizontal dentro de uma estrutura vertical.

## Comandos Uteis

Rodar frontend em desenvolvimento:

```bash
npm run dev
```

Rodar frontend com alias explicito:

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

Sincronizar Android:

```bash
npm run cap:sync
```

Build + sync Android:

```bash
npm run android:sync
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
