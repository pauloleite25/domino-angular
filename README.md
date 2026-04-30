# Domino Angular

Frontend Angular do jogo de domino com modo local contra bots, salas online simples e foco forte em experiencia mobile horizontal.

## Documentacao

- Visao geral do projeto, regras, arquitetura e decisoes atuais: `PROJETO.md`
- Contrato do backend realtime correspondente: `../backend-domino/BACKEND_DOMINO.md`

## Como rodar

Desenvolvimento do frontend:

```bash
npm run dev
```

Servidor simples de salas:

```bash
npm run lan-duo
```

Build de producao:

```bash
npm run build
```

Sincronizacao Android via Capacitor:

```bash
npm run cap:sync
```

Fluxo completo para Android:

```bash
npm run android:sync
```

## Stack

- Angular 17
- SCSS
- Capacitor Android
- Servidor local Node para salas (`scripts/lan-duo-server.mjs`)

## Estado atual

- O jogo esta otimizado primeiro para mobile em orientacao horizontal.
- A maior frente aberta hoje e design/UX, principalmente HUD mobile, distribuicao de espaco e consistencia visual entre mesa, mao, historico, placar e acoes.
- O arquivo `src/app/features/game/components/local-match-screen/local-match-screen.component.scss` concentra grande parte da camada visual da partida e ja opera perto do budget de estilo do build.
