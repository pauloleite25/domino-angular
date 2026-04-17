import { describe, expect, it } from "vitest";
import {
  applyRoundEnd,
  createEmptyBoardState,
  createBoardWithOpeningCarroca,
  createInitialRoundState,
  createNextRound,
  getLegalMoves,
  getMatchWinner,
  getRoundResult,
  hasPlayerGoneOut,
  isMatchOver,
  isRoundBlocked,
} from "@/core/domino";
import type { MatchState, RoundResult, RoundState } from "@/core/domino";

function createRoundStateBase(overrides: Partial<RoundState>): RoundState {
  return {
    roundNumber: 1,
    phase: "in_progress",
    board: createEmptyBoardState(),
    hands: {
      A: [{ left: 6, right: 6 }],
      B: [{ left: 1, right: 1 }],
      C: [{ left: 0, right: 0 }],
      D: [{ left: 2, right: 2 }],
    },
    starter: "A",
    mustOpenWithCarroca: true,
    redealCount: 0,
    ...overrides,
  };
}

function createMatchStateBase(overrides: Partial<MatchState>): MatchState {
  return {
    targetScore: 200,
    score: { AC: 0, BD: 0 },
    currentRound: createRoundStateBase({}),
    ...overrides,
  };
}

describe("round + match", () => {
  it("detecta vitoria por batida", () => {
    const state = createRoundStateBase({
      board: createBoardWithOpeningCarroca({ left: 6, right: 6 }),
      hands: {
        A: [],
        B: [{ left: 1, right: 1 }],
        C: [{ left: 0, right: 0 }],
        D: [{ left: 2, right: 3 }],
      },
    });

    expect(hasPlayerGoneOut(state)).toBe(true);
    expect(getRoundResult(state)).toEqual({
      reason: "batida",
      winnerTeam: "AC",
      winnerPlayer: "A",
      points: 5,
    });
  });

  it("detecta vitoria por travamento", () => {
    const state = createRoundStateBase({
      board: createBoardWithOpeningCarroca({ left: 6, right: 6 }),
      hands: {
        A: [{ left: 0, right: 1 }],
        B: [{ left: 2, right: 2 }],
        C: [{ left: 1, right: 1 }],
        D: [{ left: 3, right: 3 }],
      },
    });

    expect(isRoundBlocked(state)).toBe(true);
    expect(getRoundResult(state)).toEqual({
      reason: "blocked",
      winnerTeam: "AC",
      winnerPlayer: null,
      points: 5,
    });
  });

  it("avanca para nova rodada", () => {
    const roundResult: RoundResult = {
      reason: "batida",
      winnerTeam: "BD",
      winnerPlayer: "D",
      points: 30,
    };
    const matchState = createMatchStateBase({
      score: { AC: 50, BD: 40 },
      currentRound: createRoundStateBase({ roundNumber: 1 }),
      rng: () => 0.999,
    });

    const withScore = applyRoundEnd(matchState, roundResult);
    const nextRoundMatch = createNextRound(withScore);

    expect(withScore.score).toEqual({ AC: 50, BD: 70 });
    expect(nextRoundMatch.currentRound.roundNumber).toBe(2);
  });

  it("rodada seguinte comeca com quem bateu a anterior", () => {
    const withPreviousWinner = createMatchStateBase({
      currentRound: createRoundStateBase({ roundNumber: 1, starter: "A" }),
      lastRoundWinnerPlayer: "C",
      rng: () => 0.999,
    });

    const nextRoundMatch = createNextRound(withPreviousWinner);

    expect(nextRoundMatch.currentRound.starter).toBe("C");
    expect(nextRoundMatch.currentRound.mustOpenWithCarroca).toBe(true);
  });

  it("apos travamento, rodada seguinte inicia com quem tem 6-6", () => {
    const withPreviousWinner = createMatchStateBase({
      currentRound: createRoundStateBase({ roundNumber: 1, starter: "A" }),
      lastRoundWinnerPlayer: "C",
      rng: () => 0.999,
    });

    const nextRoundMatch = createNextRound(withPreviousWinner, {
      startBySixSix: true,
    });
    const starter = nextRoundMatch.currentRound.starter;
    const starterHand = nextRoundMatch.currentRound.hands[starter];

    expect(starterHand.some((tile) => tile.left === 6 && tile.right === 6)).toBe(true);
  });

  it("na primeira rodada, abertura obrigatoria com 6-6", () => {
    const state = createRoundStateBase({
      roundNumber: 1,
      board: createEmptyBoardState(),
      hands: {
        A: [
          { left: 6, right: 6 },
          { left: 5, right: 5 },
        ],
        B: [],
        C: [],
        D: [],
      },
    });

    const legalMoves = getLegalMoves(state, "A");
    expect(legalMoves).toHaveLength(1);
    expect(legalMoves[0]).toMatchObject({
      kind: "play",
      phase: "opening",
      piece: { left: 6, right: 6 },
    });
  });

  it("nas rodadas seguintes, abertura permite qualquer carroca", () => {
    const state = createRoundStateBase({
      roundNumber: 2,
      board: createEmptyBoardState(),
      hands: {
        A: [
          { left: 6, right: 6 },
          { left: 5, right: 5 },
          { left: 6, right: 5 },
        ],
        B: [],
        C: [],
        D: [],
      },
    });

    const legalMoves = getLegalMoves(state, "A");
    expect(legalMoves).toHaveLength(2);
    expect(legalMoves).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ piece: { left: 6, right: 6 } }),
        expect.objectContaining({ piece: { left: 5, right: 5 } }),
      ]),
    );
  });

  it("nao encerra durante a rodada mesmo acima de 200", () => {
    const state = createMatchStateBase({
      score: { AC: 210, BD: 180 },
      currentRound: createRoundStateBase({ phase: "in_progress" }),
    });

    expect(isMatchOver(state)).toBe(false);
    expect(getMatchWinner(state)).toBeNull();
  });

  it("encerra apenas com rodada finalizada e lideranca acima de 200", () => {
    const state = createMatchStateBase({
      score: { AC: 195, BD: 180 },
      currentRound: createRoundStateBase({ phase: "finished" }),
    });
    const withRoundPoints = applyRoundEnd(state, {
      reason: "batida",
      winnerTeam: "AC",
      winnerPlayer: "A",
      points: 10,
    });

    expect(isMatchOver(withRoundPoints)).toBe(true);
    expect(getMatchWinner(withRoundPoints)).toBe("AC");
  });

  it("mantem partida em andamento com empate acima de 200", () => {
    const state = createMatchStateBase({
      score: { AC: 205, BD: 205 },
      currentRound: createRoundStateBase({ phase: "finished" }),
    });

    expect(isMatchOver(state)).toBe(false);
    expect(getMatchWinner(state)).toBeNull();
  });

  it("setup da rodada seguinte garante carroca para quem inicia", () => {
    const round = createInitialRoundState({
      roundNumber: 2,
      previousRoundWinner: "B",
      rng: () => 0.999,
    });

    expect(round.starter).toBe("B");
    expect(round.hands.B.some((tile) => tile.left === tile.right)).toBe(true);
  });
});
