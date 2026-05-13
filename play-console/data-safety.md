# Data safety

Estas respostas sao a base mais defensavel com o estado atual do projeto frontend + backend.
Revise antes de enviar se o backend passar a coletar analytics, crash reporting de terceiros, ads ou login com conta.

## Leitura rapida do projeto atual

- O app nao usa SDK de anuncios.
- O app nao usa analytics no frontend Angular.
- O app nao pede permissao de camera, microfone, contatos ou localizacao.
- O modo online envia nickname, senha da sala, codigo da sala, sessao casual, jogadas e reacoes para o backend.
- O backend opera sessoes casuais por nickname e persiste dados de sala/partida para multiplayer.

## Resposta-base recomendada

### Does your app collect or share any of the required user data types?

Resposta recomendada: `Yes`

Motivo:

- o app envia nickname e dados de sala para o backend;
- o backend processa dados de sessao e historico de partida;
- isso conta como coleta de dados fora do dispositivo.

## Data likely collected

### Personal info

- `Name`
  - usado como nickname casual no multiplayer
  - coletado
  - nao compartilhado para publicidade
  - visivel a outros jogadores da mesma sala
  - finalidade: `App functionality`

### App activity

- `In-app interactions` ou equivalente de atividade de jogo
  - inclui jogadas, assento escolhido, status da sala, reacoes e historico da partida
  - coletado
  - finalidade: `App functionality`

## Data that is not evident in the current app

Resposta recomendada como `No`, salvo mudanca futura:

- localizacao
- contatos
- fotos e videos
- arquivos e documentos
- audio
- mensagens SMS
- calendario
- dados financeiros
- saude e fitness
- identificadores de publicidade

## Important backend review before submitting

Confirme estes pontos no backend/hosting antes de apertar `Submit`:

1. Se o provedor de hospedagem grava IP e logs de acesso de forma identificavel e persistente, revise se isso precisa entrar como dado coletado para seguranca.
2. Se futuramente houver Firebase, Sentry, analytics, crash reporting ou ads, o formulario precisa mudar.
3. Se houver exclusao de conta ou perfil autenticado no futuro, a politica de privacidade deve ser ampliada.

## Conservative note

Se voce estiver em duvida sobre como declarar logs tecnicos do servidor, use uma abordagem conservadora e consistente com a politica de privacidade. O risco maior na Play Console nao e declarar dados demais; e declarar menos do que o app e o backend realmente fazem.
