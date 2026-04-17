import type { MatchState, StartMatchInput } from "./contracts";

// Responsabilidade: expor operações puras da engine.
// Nesta fase do projeto, o módulo existe como contrato e ponto de extensão.
export function startMatch(input: StartMatchInput = {}): MatchState {
  void input;

  return {
    phase: "setup",
    board: [],
    boneyardCount: 0,
    turn: "player",
  };
}
