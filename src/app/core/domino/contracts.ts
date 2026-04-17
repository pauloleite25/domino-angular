// Responsabilidade: definir contratos estáveis da engine de dominó (sem UI).
// Regra: evitar dependência de React/Next neste diretório.

export type DominoSide = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type DominoTile = {
  readonly left: DominoSide;
  readonly right: DominoSide;
};

export type PlayerId = "player" | "cpu";

export type MatchPhase = "setup" | "in_progress" | "finished";

export type MatchState = {
  readonly phase: MatchPhase;
  readonly board: readonly DominoTile[];
  readonly boneyardCount: number;
  readonly turn: PlayerId;
};

export type StartMatchInput = {
  readonly seed?: number;
};
