import type { BoardSide, DominoValue, PlayerId, TeamId } from "./types";

// Responsabilidade: valores imutáveis de regras e configuração regional.
export const DOMINO_MIN_VALUE: DominoValue = 0;
export const DOMINO_MAX_VALUE: DominoValue = 6;
export const HAND_SIZE = 7;
export const TOTAL_PLAYERS = 4;
export const TOTAL_TILES = 28;
export const REDISTRIBUTION_CARROCA_THRESHOLD = 5;
export const BOARD_SIDES: readonly BoardSide[] = [
  "north",
  "east",
  "south",
  "west",
];

export const PLAYER_ORDER: readonly PlayerId[] = ["A", "B", "C", "D"];

export const TEAM_BY_PLAYER: Record<PlayerId, TeamId> = {
  A: "AC",
  B: "BD",
  C: "AC",
  D: "BD",
};
