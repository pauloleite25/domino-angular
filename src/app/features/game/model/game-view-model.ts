import type { RoundState } from "../../../core/domino";

// Responsabilidade: converter estado da engine em estado amigável para UI.
// Aqui mantemos apenas tipos para preservar o acoplamento baixo neste início.
export type GameViewModel = {
  readonly phaseLabel: string;
  readonly boardCount: number;
  readonly boneyardCount: number;
  readonly currentTurnLabel: string;
};

export function toGameViewModel(state: RoundState): GameViewModel {
  return {
    phaseLabel: state.phase,
    boardCount: state.board.placedTilesCount,
    boneyardCount: 0,
    currentTurnLabel: state.starter,
  };
}
