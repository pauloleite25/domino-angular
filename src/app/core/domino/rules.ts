import { BOARD_SIDES } from "./constants";
import type { BoardEnd, BoardSide, BoardState, DominoTile, PlayerId } from "./types";

// Responsabilidade: regras puras de encaixe e leitura de pontas da mesa.

export function isDouble(piece: DominoTile): boolean {
  return piece.left === piece.right;
}

export function createEmptyBoardState(): BoardState {
  return {
    openingCarroca: null,
    placedTilesCount: 0,
    ends: {
      north: { side: "north", openValue: null, branchLength: 0, tipIsDouble: false, isOpen: false },
      east: { side: "east", openValue: null, branchLength: 0, tipIsDouble: false, isOpen: false },
      south: { side: "south", openValue: null, branchLength: 0, tipIsDouble: false, isOpen: false },
      west: { side: "west", openValue: null, branchLength: 0, tipIsDouble: false, isOpen: false },
    },
  };
}

export function createBoardWithOpeningCarroca(opening: DominoTile): BoardState {
  if (!isDouble(opening)) {
    throw new Error("A primeira peca da rodada deve ser uma carroca.");
  }

  const openValue = opening.left;

  return {
    openingCarroca: opening,
    placedTilesCount: 1,
    ends: {
      north: { side: "north", openValue, branchLength: 0, tipIsDouble: true, isOpen: true },
      east: { side: "east", openValue, branchLength: 0, tipIsDouble: true, isOpen: true },
      south: { side: "south", openValue, branchLength: 0, tipIsDouble: true, isOpen: true },
      west: { side: "west", openValue, branchLength: 0, tipIsDouble: true, isOpen: true },
    },
  };
}

export function getPrimarySidesByStarter(starter: PlayerId): readonly BoardSide[] {
  void starter;
  return ["east", "west"];
}

export function getSecondarySidesByStarter(starter: PlayerId): readonly BoardSide[] {
  void starter;
  return ["north", "south"];
}

export function isSecondaryAxisUnlocked(board: BoardState, starter: PlayerId): boolean {
  const primarySides = getPrimarySidesByStarter(starter);
  return primarySides.every((side) => board.ends[side].branchLength > 0);
}

function isPlayableByAxis(
  side: BoardSide,
  board: BoardState,
  starter: PlayerId,
): boolean {
  const primarySides = getPrimarySidesByStarter(starter);
  if (primarySides.includes(side)) {
    return true;
  }

  return isSecondaryAxisUnlocked(board, starter);
}

export function getPlayableEnds(board: BoardState, starter?: PlayerId): readonly BoardEnd[] {
  if (board.openingCarroca !== null && board.placedTilesCount === 1) {
    return [board.ends.east, board.ends.west].filter(
      (end) => end.isOpen && end.openValue !== null,
    );
  }

  return BOARD_SIDES.map((side) => board.ends[side]).filter(
    (end) =>
      end.isOpen &&
      end.openValue !== null &&
      (starter === undefined || isPlayableByAxis(end.side, board, starter)),
  );
}

export function canPlayPieceOnEnd(piece: DominoTile, end: BoardEnd): boolean {
  if (!end.isOpen || end.openValue === null) {
    return false;
  }

  return piece.left === end.openValue || piece.right === end.openValue;
}

export function orientPieceForEnd(piece: DominoTile, end: BoardEnd): DominoTile {
  if (!canPlayPieceOnEnd(piece, end) || end.openValue === null) {
    throw new Error("Peca nao encaixa na ponta informada.");
  }

  if (piece.left === end.openValue) {
    return piece;
  }

  return {
    left: piece.right,
    right: piece.left,
  };
}
