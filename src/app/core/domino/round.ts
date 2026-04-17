import { PLAYER_ORDER } from "./constants";
import { getLegalMoves } from "./moves";
import {
  getBatidaBonus,
  getBlockedRoundResult,
  getTeamByPlayer,
} from "./scoring";
import type { PlayerId, RoundState, TeamId } from "./types";

// Responsabilidade: detectar fim da rodada e consolidar resultado.

export type RoundResult = {
  readonly reason: "batida" | "blocked";
  readonly winnerTeam: TeamId | null;
  readonly winnerPlayer: PlayerId | null;
  readonly points: number;
};

export function hasPlayerGoneOut(state: RoundState): boolean {
  return PLAYER_ORDER.some((playerId) => state.hands[playerId].length === 0);
}

export function getPlayerWhoWentOut(state: RoundState): PlayerId | null {
  for (const playerId of PLAYER_ORDER) {
    if (state.hands[playerId].length === 0) {
      return playerId;
    }
  }

  return null;
}

export function isRoundBlocked(state: RoundState): boolean {
  if (state.board.openingCarroca === null) {
    return false;
  }

  // Ambiguidade resolvida: rodada travada quando nenhum jogador possui jogada legal.
  return PLAYER_ORDER.every((playerId) =>
    getLegalMoves(state, playerId).every((move) => move.kind === "pass"),
  );
}

export function getRoundResult(state: RoundState): RoundResult | null {
  const playerWhoWentOut = getPlayerWhoWentOut(state);
  if (playerWhoWentOut !== null) {
    const winnerTeam = getTeamByPlayer(playerWhoWentOut);

    return {
      reason: "batida",
      winnerTeam,
      winnerPlayer: playerWhoWentOut,
      points: getBatidaBonus(state, winnerTeam),
    };
  }

  if (!isRoundBlocked(state)) {
    return null;
  }

  const blockedResult = getBlockedRoundResult(state);

  return {
    reason: "blocked",
    winnerTeam: blockedResult.winnerTeam,
    winnerPlayer: null,
    points: blockedResult.points,
  };
}
