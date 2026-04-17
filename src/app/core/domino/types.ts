// Responsabilidade: contratos centrais da engine de dominó regional (sem UI).

export type DominoValue = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type DominoTile = {
  readonly left: DominoValue;
  readonly right: DominoValue;
};

export type BoardSide = "north" | "east" | "south" | "west";

export type BoardEnd = {
  readonly side: BoardSide;
  readonly openValue: DominoValue | null;
  readonly branchLength: number;
  readonly tipIsDouble: boolean;
  readonly isOpen: boolean;
};

export type BoardState = {
  // Modelagem simples: cada lado da carroca inicial evolui como um ramo linear.
  readonly openingCarroca: DominoTile | null;
  readonly ends: Record<BoardSide, BoardEnd>;
  readonly placedTilesCount: number;
};

export type PlayerId = "A" | "B" | "C" | "D";

export type TeamId = "AC" | "BD";

export type HandsByPlayer = Record<PlayerId, readonly DominoTile[]>;

export type RoundPhase = "setup" | "in_progress" | "finished";

export type RoundState = {
  readonly roundNumber: number;
  readonly phase: RoundPhase;
  readonly board: BoardState;
  readonly hands: HandsByPlayer;
  readonly starter: PlayerId;
  readonly mustOpenWithCarroca: true;
  readonly previousRoundWinner?: PlayerId;
  readonly redealCount: number;
};

export type CreateInitialRoundStateInput = {
  readonly roundNumber: number;
  readonly previousRoundWinner?: PlayerId;
  readonly rng?: () => number;
};
