import { TEAM_BY_PLAYER } from "./constants";
import { getPlayableEnds, getPrimarySidesByStarter } from "./rules";
import type { BoardState, DominoTile, PlayerId, RoundState, TeamId } from "./types";

// Responsabilidade: pontuação pura da variante regional.

export type BlockedRoundResult = {
  readonly winnerTeam: TeamId | null;
  readonly points: number;
  readonly totals: {
    readonly AC: number;
    readonly BD: number;
  };
};

export function roundDownToNearestFive(value: number): number {
  return Math.floor(value / 5) * 5;
}

export function sumOpenEnds(board: BoardState, starter: PlayerId): number {
  const primarySides = new Set(getPrimarySidesByStarter(starter));

  return getPlayableEnds(board, starter).reduce((sum, end) => {
    if (end.openValue === null) {
      return sum;
    }

    // Regra da variante:
    // - lado bloqueado não entra (já é filtrado por getPlayableEnds)
    // - lado vazio (branchLength = 0) só conta no eixo primário
    // - ponta com carroça vale dobrado
    if (end.branchLength === 0 && !primarySides.has(end.side)) {
      return sum;
    }

    const endValue = end.tipIsDouble ? end.openValue * 2 : end.openValue;
    return sum + endValue;
  }, 0);
}

export function getBoardScore(openEndsSum: number): number {
  if (openEndsSum > 0 && openEndsSum % 5 === 0) {
    return openEndsSum;
  }

  return 0;
}

export function getScoreForPlayedMove(board: BoardState, starter: PlayerId): number {
  return getBoardScore(sumOpenEnds(board, starter));
}

export function getPassPenalty(): number {
  return 20;
}

export function sumHand(hand: readonly DominoTile[]): number {
  return hand.reduce((sum, tile) => sum + tile.left + tile.right, 0);
}

export function sumTeamHands(state: RoundState, teamId: TeamId): number {
  if (teamId === "AC") {
    return sumHand(state.hands.A) + sumHand(state.hands.C);
  }

  return sumHand(state.hands.B) + sumHand(state.hands.D);
}

function getOpponentTeam(teamId: TeamId): TeamId {
  return teamId === "AC" ? "BD" : "AC";
}

export function getTeamByPlayer(playerId: PlayerId): TeamId {
  return TEAM_BY_PLAYER[playerId];
}

export function getPassPenaltyAwardedTeam(playerId: PlayerId): TeamId {
  return getOpponentTeam(getTeamByPlayer(playerId));
}

export function getBatidaBonus(state: RoundState, winnerTeam: TeamId): number {
  const loserTeam = getOpponentTeam(winnerTeam);
  const loserPips = sumTeamHands(state, loserTeam);

  return roundDownToNearestFive(loserPips);
}

export function getBlockedRoundResult(state: RoundState): BlockedRoundResult {
  const acTotal = sumTeamHands(state, "AC");
  const bdTotal = sumTeamHands(state, "BD");

  // Ambiguidade resolvida: em empate de travamento, ninguém pontua.
  if (acTotal === bdTotal) {
    return {
      winnerTeam: null,
      points: 0,
      totals: {
        AC: acTotal,
        BD: bdTotal,
      },
    };
  }

  const winnerTeam: TeamId = acTotal < bdTotal ? "AC" : "BD";
  const loserTotal = winnerTeam === "AC" ? bdTotal : acTotal;
  const points = roundDownToNearestFive(loserTotal);

  return {
    winnerTeam,
    points,
    totals: {
      AC: acTotal,
      BD: bdTotal,
    },
  };
}
