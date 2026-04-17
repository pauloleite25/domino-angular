import { isCarroca } from "./helpers";
import { DOMINO_MAX_VALUE } from "./constants";
import {
  canPlayPieceOnEnd,
  getPlayableEnds,
  orientPieceForEnd,
} from "./rules";
import type { BoardSide, DominoTile, PlayerId, RoundState } from "./types";

// Responsabilidade: listar jogadas validas sem aplicar estado.

export type PlayOpeningMove = {
  readonly kind: "play";
  readonly phase: "opening";
  readonly piece: DominoTile;
};

export type PlayOnEndMove = {
  readonly kind: "play";
  readonly phase: "end";
  readonly endSide: BoardSide;
  readonly piece: DominoTile;
  readonly orientedPiece: DominoTile;
};

export type PassMove = {
  readonly kind: "pass";
  readonly reason: "no_legal_moves";
};

export type LegalMove = PlayOpeningMove | PlayOnEndMove | PassMove;

function getOpeningMoves(state: RoundState, playerId: PlayerId): readonly PlayOpeningMove[] {
  if (state.board.openingCarroca !== null) {
    return [];
  }

  const hand = state.hands[playerId];

  if (state.roundNumber === 1) {
    return hand
      .filter(
        (piece) =>
          piece.left === DOMINO_MAX_VALUE && piece.right === DOMINO_MAX_VALUE,
      )
      .map((piece) => ({ kind: "play", phase: "opening", piece }));
  }

  if (!state.mustOpenWithCarroca) {
    return hand.map((piece) => ({ kind: "play", phase: "opening", piece }));
  }

  return hand
    .filter((piece) => isCarroca(piece))
    .map((piece) => ({ kind: "play", phase: "opening", piece }));
}

function getEndMoves(state: RoundState, playerId: PlayerId): readonly PlayOnEndMove[] {
  if (state.board.openingCarroca === null) {
    return [];
  }

  const hand = state.hands[playerId];
  const ends = getPlayableEnds(state.board, state.starter);
  const moves: PlayOnEndMove[] = [];

  for (const piece of hand) {
    for (const end of ends) {
      if (!canPlayPieceOnEnd(piece, end)) {
        continue;
      }

      moves.push({
        kind: "play",
        phase: "end",
        endSide: end.side,
        piece,
        orientedPiece: orientPieceForEnd(piece, end),
      });
    }
  }

  return moves;
}

function getPlayableMoves(state: RoundState, playerId: PlayerId): readonly (PlayOpeningMove | PlayOnEndMove)[] {
  const openingMoves = getOpeningMoves(state, playerId);
  if (openingMoves.length > 0) {
    return openingMoves;
  }

  return getEndMoves(state, playerId);
}

export function canPass(state: RoundState, playerId: PlayerId): boolean {
  return getPlayableMoves(state, playerId).length === 0;
}

export function getLegalMoves(state: RoundState, playerId: PlayerId): readonly LegalMove[] {
  const playableMoves = getPlayableMoves(state, playerId);
  if (playableMoves.length > 0) {
    return playableMoves;
  }

  return [{ kind: "pass", reason: "no_legal_moves" }];
}
