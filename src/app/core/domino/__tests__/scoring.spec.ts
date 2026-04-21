import { describe, expect, it } from "vitest";
import {
  getBatidaBonus,
  getBlockedRoundResult,
  getBoardScore,
  getPassPenalty,
  getPassPenaltyAwardedTeam,
  getScoreForPlayedMove,
  roundDownToNearestFive,
  sumOpenEnds,
} from "@/core/domino";
import type { BoardState, RoundState } from "@/core/domino";

function createRoundStateFixture(): RoundState {
  return {
    roundNumber: 1,
    phase: "in_progress",
    board: {
      openingCarroca: { left: 6, right: 6 },
      placedTilesCount: 5,
      ends: {
        north: { side: "north", openValue: 6, branchLength: 1, tipIsDouble: false, isOpen: true },
        east: { side: "east", openValue: 4, branchLength: 2, tipIsDouble: false, isOpen: true },
        south: { side: "south", openValue: 3, branchLength: 2, tipIsDouble: false, isOpen: true },
        west: { side: "west", openValue: 2, branchLength: 1, tipIsDouble: false, isOpen: true },
      },
    },
    hands: {
      A: [{ left: 6, right: 5 }],
      B: [{ left: 1, right: 1 }, { left: 3, right: 3 }],
      C: [{ left: 0, right: 2 }],
      D: [{ left: 6, right: 6 }, { left: 4, right: 5 }],
    },
    starter: "A",
    mustOpenWithCarroca: true,
    redealCount: 0,
  };
}

function createBoardWithOpeningByStarter(starter: "A" | "B"): BoardState {
  const isHorizontalOpening = starter === "A";

  return {
    openingCarroca: { left: 6, right: 6 },
    placedTilesCount: 3,
    ends: {
      north: {
        side: "north",
        openValue: isHorizontalOpening ? 1 : 6,
        branchLength: isHorizontalOpening ? 1 : 0,
        tipIsDouble: false,
        isOpen: true,
      },
      south: {
        side: "south",
        openValue: isHorizontalOpening ? 5 : 6,
        branchLength: isHorizontalOpening ? 1 : 0,
        tipIsDouble: false,
        isOpen: true,
      },
      east: {
        side: "east",
        openValue: isHorizontalOpening ? 6 : 4,
        branchLength: isHorizontalOpening ? 0 : 1,
        tipIsDouble: isHorizontalOpening,
        isOpen: true,
      },
      west: {
        side: "west",
        openValue: isHorizontalOpening ? 6 : 2,
        branchLength: isHorizontalOpening ? 0 : 1,
        tipIsDouble: isHorizontalOpening,
        isOpen: true,
      },
    },
  };
}

describe("scoring da engine", () => {
  it("soma as pontas abertas da mesa", () => {
    const state = createRoundStateFixture();

    expect(sumOpenEnds(state.board, state.starter)).toBe(15);
  });

  it("pontua quando soma das pontas e multiplo de 5", () => {
    expect(getBoardScore(15)).toBe(15);
    const state = createRoundStateFixture();
    expect(getScoreForPlayedMove(state.board, state.starter)).toBe(15);
  });

  it("nao pontua quando soma nao e multiplo de 5", () => {
    expect(getBoardScore(14)).toBe(0);
  });

  it("aplica penalidade de passe (+20 para dupla adversaria)", () => {
    expect(getPassPenalty()).toBe(20);
    expect(getPassPenaltyAwardedTeam("A")).toBe("BD");
    expect(getPassPenaltyAwardedTeam("D")).toBe("AC");
  });

  it("calcula bonus por batida", () => {
    const state = createRoundStateFixture();

    // Equipe BD restante: (1+1+3+3) + (6+6+4+5) = 29 -> 25.
    expect(getBatidaBonus(state, "AC")).toBe(25);
  });

  it("calcula resultado por travamento", () => {
    const state = createRoundStateFixture();

    // AC = (6+5) + (0+2) = 13
    // BD = (1+1+3+3) + (6+6+4+5) = 29
    // Equipe com menos pontos vence e recebe os pontos da dupla adversaria: 29 -> 25 para AC.
    expect(getBlockedRoundResult(state)).toEqual({
      winnerTeam: "AC",
      points: 25,
      totals: {
        AC: 13,
        BD: 29,
      },
    });
  });

  it("arredonda para baixo no multiplo de 5", () => {
    expect(roundDownToNearestFive(24)).toBe(20);
    expect(roundDownToNearestFive(25)).toBe(25);
    expect(roundDownToNearestFive(29)).toBe(25);
  });

  it("conta carroca na ponta com valor dobrado e ignora eixo secundario bloqueado", () => {
    const state = createRoundStateFixture();
    const board = {
      ...state.board,
      ends: {
        north: { side: "north" as const, openValue: 3 as const, branchLength: 2, tipIsDouble: true, isOpen: true },
        south: { side: "south" as const, openValue: 6 as const, branchLength: 0, tipIsDouble: true, isOpen: true },
        east: { side: "east" as const, openValue: 6 as const, branchLength: 0, tipIsDouble: true, isOpen: true },
        west: { side: "west" as const, openValue: 6 as const, branchLength: 0, tipIsDouble: true, isOpen: true },
      },
    };

    expect(sumOpenEnds(board, "A")).toBe(18);
    expect(getScoreForPlayedMove(board, "A")).toBe(0);
  });

  it("horizontal: com north/south ocupados, west/east vazios continuam valendo 0", () => {
    const board = createBoardWithOpeningByStarter("A");

    expect(sumOpenEnds(board, "A")).toBe(6);
    expect(getScoreForPlayedMove(board, "A")).toBe(0);
  });

  it("vertical: com apenas west/east ocupados, north/south vazios valem 0", () => {
    const board = createBoardWithOpeningByStarter("B");

    expect(sumOpenEnds(board, "B")).toBe(6);
    expect(getScoreForPlayedMove(board, "B")).toBe(0);
  });

  it("cenario [6|6], [6|1], [6|5] soma 6 e nao pontua", () => {
    const board = createBoardWithOpeningByStarter("A");

    expect(sumOpenEnds(board, "A")).toBe(6);
    expect(getScoreForPlayedMove(board, "A")).toBe(0);
  });

  it("cenario [6|6], [6|4], [4|4] no eixo west/east soma 20 e pontua 20", () => {
    const board: BoardState = {
      openingCarroca: { left: 6, right: 6 },
      placedTilesCount: 3,
      ends: {
        north: { side: "north", openValue: 6, branchLength: 0, tipIsDouble: true, isOpen: true },
        south: { side: "south", openValue: 6, branchLength: 0, tipIsDouble: true, isOpen: true },
        east: { side: "east", openValue: 6, branchLength: 0, tipIsDouble: true, isOpen: true },
        west: { side: "west", openValue: 4, branchLength: 2, tipIsDouble: true, isOpen: true },
      },
    };

    expect(sumOpenEnds(board, "B")).toBe(20);
    expect(getScoreForPlayedMove(board, "B")).toBe(20);
  });

  it("quando os quatro lados estao ativos, soma todos normalmente", () => {
    const board: BoardState = {
      openingCarroca: { left: 6, right: 6 },
      placedTilesCount: 5,
      ends: {
        north: { side: "north", openValue: 3, branchLength: 1, tipIsDouble: false, isOpen: true },
        south: { side: "south", openValue: 2, branchLength: 1, tipIsDouble: false, isOpen: true },
        east: { side: "east", openValue: 4, branchLength: 1, tipIsDouble: false, isOpen: true },
        west: { side: "west", openValue: 1, branchLength: 1, tipIsDouble: false, isOpen: true },
      },
    };

    expect(sumOpenEnds(board, "A")).toBe(10);
    expect(getScoreForPlayedMove(board, "A")).toBe(10);
  });
});
