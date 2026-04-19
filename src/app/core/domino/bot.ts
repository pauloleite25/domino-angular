import { BOARD_SIDES, PLAYER_ORDER } from "./constants";
import { tileKey } from "./helpers";
import { getLegalMoves } from "./moves";
import { getBoardScore, getTeamByPlayer, sumOpenEnds } from "./scoring";
import { createBoardWithOpeningCarroca, isDouble } from "./rules";
import type { LegalMove, PlayOnEndMove, PlayOpeningMove } from "./moves";
import type { BoardSide, DominoTile, PlayerId, RoundState } from "./types";

// Responsabilidade: escolher uma jogada segura e determinística para o bot.

export type ChooseBotMoveOptions = {
  readonly turnOrder?: readonly PlayerId[];
  readonly rng?: () => number;
  readonly bonusScoreOpportunity?: number;
};

function isPlayableMove(move: LegalMove): move is PlayOpeningMove | PlayOnEndMove {
  return move.kind === "play";
}

function getPieceTotal(move: PlayOpeningMove | PlayOnEndMove): number {
  return move.piece.left + move.piece.right;
}

function getSidePriority(side: BoardSide): number {
  const index = BOARD_SIDES.indexOf(side);
  return index >= 0 ? index : Number.MAX_SAFE_INTEGER;
}

function samePiece(left: DominoTile, right: DominoTile): boolean {
  return left.left === right.left && left.right === right.right;
}

function removePieceFromHand(
  hand: readonly DominoTile[],
  piece: DominoTile,
): readonly DominoTile[] {
  let removed = false;

  return hand.filter((tile) => {
    if (!removed && samePiece(tile, piece)) {
      removed = true;
      return false;
    }

    return true;
  });
}

function estimateImmediateScore(state: RoundState, move: PlayOpeningMove | PlayOnEndMove): number {
  if (move.phase === "opening") {
    // Modelagem simples: abertura com carroça expõe os 4 lados com o mesmo valor.
    const openedBoard = createBoardWithOpeningCarroca(move.piece);
    return getBoardScore(sumOpenEnds(openedBoard, state.starter));
  }

  const end = state.board.ends[move.endSide];
  if (!end.isOpen || end.openValue === null) {
    return 0;
  }

  // Sem aplicar estado: ajusta apenas a ponta afetada para estimar pontuação da jogada.
  const simulatedBoard = {
    ...state.board,
    ends: {
      ...state.board.ends,
      [move.endSide]: {
        ...end,
        openValue: move.orientedPiece.right,
        branchLength: end.branchLength + 1,
        tipIsDouble: isDouble(move.orientedPiece),
      },
    },
  };
  const updatedOpenEndsSum = sumOpenEnds(simulatedBoard, state.starter);

  return getBoardScore(updatedOpenEndsSum);
}

function applyPlayMove(
  state: RoundState,
  playerId: PlayerId,
  move: PlayOpeningMove | PlayOnEndMove,
): RoundState {
  const hands = {
    ...state.hands,
    [playerId]: removePieceFromHand(state.hands[playerId], move.piece),
  };

  if (move.phase === "opening") {
    return {
      ...state,
      phase: "in_progress",
      hands,
      board: createBoardWithOpeningCarroca(move.piece),
    };
  }

  const currentEnd = state.board.ends[move.endSide];
  return {
    ...state,
    phase: "in_progress",
    hands,
    board: {
      ...state.board,
      placedTilesCount: state.board.placedTilesCount + 1,
      ends: {
        ...state.board.ends,
        [move.endSide]: {
          ...currentEnd,
          openValue: move.orientedPiece.right,
          branchLength: currentEnd.branchLength + 1,
          tipIsDouble: isDouble(move.orientedPiece),
          isOpen: true,
        },
      },
    },
  };
}

function countPlayableMoves(state: RoundState, playerId: PlayerId): number {
  return getLegalMoves(state, playerId).filter(isPlayableMove).length;
}

function getNextPlayer(
  playerId: PlayerId,
  turnOrder: readonly PlayerId[],
): PlayerId | null {
  const index = turnOrder.indexOf(playerId);
  if (index < 0) {
    return null;
  }

  return turnOrder[(index + 1) % turnOrder.length];
}

function getPartner(playerId: PlayerId): PlayerId {
  return getTeamByPlayer(playerId) === "AC"
    ? playerId === "A" ? "C" : "A"
    : playerId === "B" ? "D" : "B";
}

function getBestImmediateResponseScore(
  state: RoundState,
  playerId: PlayerId | null,
): number {
  if (playerId === null) {
    return 0;
  }

  const playableMoves = getLegalMoves(state, playerId).filter(isPlayableMove);
  if (playableMoves.length === 0) {
    return 0;
  }

  return Math.max(
    ...playableMoves.map((move) => estimateImmediateScore(state, move)),
  );
}

function countOpenValueMatches(
  state: RoundState,
  hand: readonly DominoTile[],
): number {
  const openValues = new Set(
    Object.values(state.board.ends)
      .filter((end) => end.isOpen && end.openValue !== null)
      .map((end) => end.openValue),
  );

  return hand.reduce(
    (count, tile) =>
      count +
      (openValues.has(tile.left) ? 1 : 0) +
      (openValues.has(tile.right) ? 1 : 0),
    0,
  );
}

export function chooseBotMove(
  state: RoundState,
  playerId: PlayerId,
  options: ChooseBotMoveOptions = {},
): LegalMove {
  const legalMoves = getLegalMoves(state, playerId);
  const playableMoves = legalMoves.filter(isPlayableMove);

  if (playableMoves.length === 0) {
    return { kind: "pass", reason: "no_legal_moves" };
  }

  const turnOrder = options.turnOrder ?? PLAYER_ORDER;
  const nextPlayer = getNextPlayer(playerId, turnOrder);
  const nextPlayerIsOpponent =
    nextPlayer !== null && getTeamByPlayer(nextPlayer) !== getTeamByPlayer(playerId);
  const partner = getPartner(playerId);
  const nextPlayerMovesBefore =
    nextPlayer !== null ? countPlayableMoves(state, nextPlayer) : 0;
  const partnerMovesBefore = countPlayableMoves(state, partner);

  const rankedMoves = playableMoves.map((move) => {
    const stateAfterMove = applyPlayMove(state, playerId, move);
    const nextPlayerMovesAfter =
      nextPlayer !== null ? countPlayableMoves(stateAfterMove, nextPlayer) : 0;
    const partnerMovesAfter = countPlayableMoves(stateAfterMove, partner);
    const opponentBlockScore = nextPlayerIsOpponent
      ? nextPlayerMovesBefore - nextPlayerMovesAfter
      : 0;
    const partnerProtectionScore = partnerMovesAfter - partnerMovesBefore;
    const ownFutureMoves = countPlayableMoves(stateAfterMove, playerId);
    const openValueMatches = countOpenValueMatches(
      stateAfterMove,
      stateAfterMove.hands[playerId],
    );
    const opponentBestResponseScore = nextPlayerIsOpponent
      ? getBestImmediateResponseScore(stateAfterMove, nextPlayer)
      : 0;
    const immediateScore = estimateImmediateScore(state, move);
    const scoreOpportunity = immediateScore + (options.bonusScoreOpportunity ?? 0);
    const strategicScore =
      scoreOpportunity * 100 +
      opponentBlockScore * 15 +
      partnerProtectionScore * 30 +
      ownFutureMoves * 4 +
      openValueMatches * 2 -
      opponentBestResponseScore * 20;

    return {
      move,
      immediateScore,
      scoreOpportunity,
      strategicScore,
      pieceTotal: getPieceTotal(move),
    };
  });

  if (options.rng !== undefined && rankedMoves.length > 1) {
    const topScore = Math.max(...rankedMoves.map((item) => item.strategicScore));
    const topMoves = rankedMoves.filter((item) => item.strategicScore === topScore);
    const randomIndex = Math.floor(options.rng() * topMoves.length);
    return topMoves[randomIndex].move;
  }

  rankedMoves.sort((a, b) => {
    if (a.strategicScore !== b.strategicScore) {
      return b.strategicScore - a.strategicScore;
    }

    if (a.immediateScore !== b.immediateScore) {
      return b.immediateScore - a.immediateScore;
    }

    if (a.pieceTotal !== b.pieceTotal) {
      return b.pieceTotal - a.pieceTotal;
    }

    if (a.move.phase !== b.move.phase) {
      return a.move.phase === "opening" ? -1 : 1;
    }

    if (a.move.phase === "end" && b.move.phase === "end") {
      const sidePriorityDiff =
        getSidePriority(a.move.endSide) - getSidePriority(b.move.endSide);
      if (sidePriorityDiff !== 0) {
        return sidePriorityDiff;
      }
    }

    return tileKey(a.move.piece).localeCompare(tileKey(b.move.piece));
  });

  return rankedMoves[0].move;
}
