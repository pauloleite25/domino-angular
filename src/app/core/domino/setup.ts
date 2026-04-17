import {
  DOMINO_MAX_VALUE,
  DOMINO_MIN_VALUE,
  HAND_SIZE,
  PLAYER_ORDER,
  REDISTRIBUTION_CARROCA_THRESHOLD,
  TOTAL_PLAYERS,
  TOTAL_TILES,
} from "./constants";
import { hasTile, isCarroca } from "./helpers";
import { createEmptyBoardState } from "./rules";
import type {
  CreateInitialRoundStateInput,
  DominoTile,
  HandsByPlayer,
  PlayerId,
  RoundState,
} from "./types";

// Responsabilidade: funções puras de preparação de rodada.

export function generateTiles(): readonly DominoTile[] {
  const tiles: DominoTile[] = [];

  for (let left = DOMINO_MIN_VALUE; left <= DOMINO_MAX_VALUE; left += 1) {
    for (let right = left; right <= DOMINO_MAX_VALUE; right += 1) {
      tiles.push({ left, right });
    }
  }

  return tiles;
}

export function shuffleTiles(
  tiles: readonly DominoTile[],
  rng: () => number = Math.random,
): readonly DominoTile[] {
  const shuffled = [...tiles];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(rng() * (index + 1));
    const current = shuffled[index];
    shuffled[index] = shuffled[randomIndex];
    shuffled[randomIndex] = current;
  }

  return shuffled;
}

export function dealTiles(tiles: readonly DominoTile[]): HandsByPlayer {
  if (tiles.length !== TOTAL_TILES) {
    throw new Error(
      `A distribuição exige ${TOTAL_TILES} peças, recebido ${tiles.length}.`,
    );
  }

  const expectedHandSize = tiles.length / TOTAL_PLAYERS;
  if (expectedHandSize !== HAND_SIZE) {
    throw new Error(
      `A distribuição exige ${HAND_SIZE} peças por jogador, recebido ${expectedHandSize}.`,
    );
  }

  const hands: HandsByPlayer = { A: [], B: [], C: [], D: [] };

  PLAYER_ORDER.forEach((playerId, playerIndex) => {
    const start = playerIndex * HAND_SIZE;
    const end = start + HAND_SIZE;
    hands[playerId] = tiles.slice(start, end);
  });

  return hands;
}

export function countCarrocas(hand: readonly DominoTile[]): number {
  return hand.filter((tile) => isCarroca(tile)).length;
}

export function needsRedistribution(hands: HandsByPlayer): boolean {
  return PLAYER_ORDER.some(
    (playerId) =>
      countCarrocas(hands[playerId]) >= REDISTRIBUTION_CARROCA_THRESHOLD,
  );
}

export function findPlayerWithSixSix(hands: HandsByPlayer): PlayerId | null {
  const sixSix: DominoTile = { left: DOMINO_MAX_VALUE, right: DOMINO_MAX_VALUE };

  for (const playerId of PLAYER_ORDER) {
    if (hasTile(hands[playerId], sixSix)) {
      return playerId;
    }
  }

  return null;
}

function resolveStarter(
  roundNumber: number,
  previousRoundWinner: PlayerId | undefined,
  hands: HandsByPlayer,
): PlayerId {
  if (roundNumber === 1 || previousRoundWinner === undefined) {
    const starter = findPlayerWithSixSix(hands);
    if (starter === null) {
      throw new Error("Nao foi possivel encontrar a peca 6-6 na distribuicao.");
    }

    return starter;
  }

  return previousRoundWinner;
}

function starterHasRequiredOpeningPiece(
  hands: HandsByPlayer,
  starter: PlayerId,
  roundNumber: number,
): boolean {
  if (roundNumber === 1) {
    return hasTile(hands[starter], { left: DOMINO_MAX_VALUE, right: DOMINO_MAX_VALUE });
  }

  return hands[starter].some((tile) => isCarroca(tile));
}

export function createInitialRoundState(
  input: CreateInitialRoundStateInput,
): RoundState {
  const { roundNumber, previousRoundWinner, rng = Math.random } = input;

  if (roundNumber < 1) {
    throw new Error("roundNumber deve ser maior ou igual a 1.");
  }

  let redealCount = 0;
  let hands: HandsByPlayer;
  let starter: PlayerId;

  do {
    const generatedTiles = generateTiles();
    const shuffledTiles = shuffleTiles(generatedTiles, rng);
    hands = dealTiles(shuffledTiles);
    starter = resolveStarter(roundNumber, previousRoundWinner, hands);

    if (
      needsRedistribution(hands) ||
      !starterHasRequiredOpeningPiece(hands, starter, roundNumber)
    ) {
      redealCount += 1;
    }
  } while (
    needsRedistribution(hands) ||
    !starterHasRequiredOpeningPiece(hands, starter, roundNumber)
  );

  return {
    roundNumber,
    phase: "setup",
    board: createEmptyBoardState(),
    hands,
    starter,
    mustOpenWithCarroca: true,
    previousRoundWinner,
    redealCount,
  };
}
