# Interface Design System

## Direction

- mesa teatral com HUD periferica compacta
- mobile horizontal como contexto principal
- mesa como palco principal, HUD como borda funcional
- interface quente, tatil, compacta e legivel

## Human

- jogador casual em sessao curta
- quer entender a mesa rapido
- precisa localizar a mao sem friccao
- quer consultar placar e historico sem perder o jogo de vista

## Core Priorities

1. mesa legivel
2. mao do jogador com prioridade visual
3. acao principal clara
4. HUD compacta e secundaria

## Signature

- a mesa domina o centro
- a HUD encosta nas bordas
- a mao parece um objeto fisico estavel
- placar, historico e acoes pertencem a mesma familia visual

## Palette

- feltro verde escuro
- madeira castanha quente
- dourado envelhecido
- marfim de peca
- sombra escura suave

## Depth

- estrategia principal: borders-first
- sombras apenas para separacao sutil
- evitar sombras dramaticas
- evitar multiplas estrategias concorrentes

## Surfaces

- mesa = superficie principal
- HUD = um nivel acima da mesa
- pecas do jogador = prioridade acima da HUD
- controles devem parecer encaixados, nao brilhantes

## Typography

- titulos curtos e fortes
- labels compactos e legiveis
- numeros de placar com peso maior do que o texto auxiliar
- evitar textos longos em botoes

## Spacing

- base preferencial: 4px
- usar multiplos claros
- evitar espacamentos soltos sem justificativa

## Radius

- pequeno em chips e controles
- medio em paineis compactos
- maior apenas em modais

## HUD Rules

- historico e placar devem ser compactos
- acoes devem ser curtas e previsiveis
- painel lateral e botoes da mao devem permanecer visiveis ao mesmo tempo
- o suporte da mao do jogador nunca pode ficar por baixo do painel lateral
- a faixa inferior deve reservar espaco real para o painel lateral antes da mao
- a HUD nao pode empurrar a mao alem do necessario
- a HUD nao pode competir com o centro da mesa
- cards dos adversarios devem ser compactos

## Mobile Action Rule

- sempre apenas dois botoes visiveis por vez
- `Sair` fixo
- botao principal alterna entre `Nova` e `Proxima`
- textos de botao devem caber sem quebrar nem ultrapassar a area util
- botoes devem usar largura pelo conteudo curto, evitando colunas largas fixas
- nenhuma regra responsiva pode ocultar os botoes ou o painel lateral por conflito de `display`, largura ou escopo de variavel

## Review Checklist

- a mesa continua visivel?
- a mao ainda e o foco da base?
- os textos continuam curtos?
- o placar/historico continuam subordinados?
- o ajuste melhora o conjunto, e nao so um componente isolado?
