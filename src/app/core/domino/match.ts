import { createInitialRoundState } from "./setup";
import type { RoundResult } from "./round";
import type { PlayerId, RoundState, TeamId } from "./types";

// Responsabilidade: acumular placar da partida e preparar próxima rodada.

export type MatchScore = {
  readonly AC: number;
  readonly BD: number;
};

export type MatchState = {
  readonly targetScore: number;
  readonly score: MatchScore;
  readonly currentRound: RoundState;
  readonly lastRoundWinnerPlayer?: PlayerId;
  readonly rng?: () => number;
};

export function createInitialMatchState(
  rng?: () => number,
  targetScore = 200,
): MatchState {
  return {
    targetScore,
    score: { AC: 0, BD: 0 },
    currentRound: createInitialRoundState({ roundNumber: 1, rng }),
    rng,
  };
}

function addRoundPoints(
  score: MatchScore,
  winnerTeam: TeamId | null,
  points: number,
): MatchScore {
  if (winnerTeam === null || points <= 0) {
    return score;
  }

  if (winnerTeam === "AC") {
    return {
      AC: score.AC + points,
      BD: score.BD,
    };
  }

  return {
    AC: score.AC,
    BD: score.BD + points,
  };
}

export function applyRoundEnd(
  matchState: MatchState,
  roundResult: RoundResult,
): MatchState {
  return {
    ...matchState,
    score: addRoundPoints(matchState.score, roundResult.winnerTeam, roundResult.points),
    lastRoundWinnerPlayer:
      roundResult.winnerPlayer ?? matchState.lastRoundWinnerPlayer,
  };
}

export function createNextRound(
  matchState: MatchState,
  options?: {
    readonly startBySixSix?: boolean;
  },
): MatchState {
  const nextRoundNumber = matchState.currentRound.roundNumber + 1;
  const previousRoundWinner = options?.startBySixSix
    ? undefined
    : (matchState.lastRoundWinnerPlayer ?? matchState.currentRound.starter);

  // Ambiguidade resolvida: sem "batida" registrada, mantemos o starter anterior.
  const currentRound = createInitialRoundState({
    roundNumber: nextRoundNumber,
    previousRoundWinner,
    rng: matchState.rng,
  });

  return {
    ...matchState,
    currentRound,
  };
}

export function isMatchOver(matchState: MatchState): boolean {
  if (matchState.currentRound.phase !== "finished") {
    return false;
  }

  const reachedTarget =
    matchState.score.AC >= matchState.targetScore ||
    matchState.score.BD >= matchState.targetScore;

  if (!reachedTarget) {
    return false;
  }

  return matchState.score.AC !== matchState.score.BD;
}

export function getMatchWinner(matchState: MatchState): TeamId | null {
  if (!isMatchOver(matchState)) {
    return null;
  }

  return matchState.score.AC > matchState.score.BD ? "AC" : "BD";
}
