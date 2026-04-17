import { describe, expect, it } from "vitest";
import { chooseBotMove, createBoardWithOpeningCarroca } from "@/core/domino";
import type { DominoValue, RoundState } from "@/core/domino";

function createStateWithOpenEnds(
  handA: RoundState["hands"]["A"],
  openValues: Partial<Record<"north" | "east" | "south" | "west", DominoValue>>,
  hands: Partial<RoundState["hands"]> = {},
): RoundState {
  const baseBoard = createBoardWithOpeningCarroca({ left: 6, right: 6 });

  return {
    roundNumber: 2,
    phase: "in_progress",
    board: {
      ...baseBoard,
      ends: {
        north: {
          ...baseBoard.ends.north,
          openValue: openValues.north ?? null,
          branchLength: openValues.north !== undefined ? 1 : 0,
          tipIsDouble: openValues.north === undefined,
          isOpen: openValues.north !== undefined,
        },
        east: {
          ...baseBoard.ends.east,
          openValue: openValues.east ?? null,
          branchLength: openValues.east !== undefined ? 1 : 0,
          tipIsDouble: openValues.east === undefined,
          isOpen: openValues.east !== undefined,
        },
        south: {
          ...baseBoard.ends.south,
          openValue: openValues.south ?? null,
          branchLength: openValues.south !== undefined ? 1 : 0,
          tipIsDouble: openValues.south === undefined,
          isOpen: openValues.south !== undefined,
        },
        west: {
          ...baseBoard.ends.west,
          openValue: openValues.west ?? null,
          branchLength: openValues.west !== undefined ? 1 : 0,
          tipIsDouble: openValues.west === undefined,
          isOpen: openValues.west !== undefined,
        },
      },
    },
    hands: {
      A: handA,
      B: hands.B ?? [],
      C: hands.C ?? [],
      D: hands.D ?? [],
    },
    starter: "A",
    mustOpenWithCarroca: true,
    redealCount: 0,
  };
}

describe("chooseBotMove", () => {
  it("escolhe uma jogada válida entre múltiplas possibilidades", () => {
    const state = createStateWithOpenEnds(
      [
        { left: 6, right: 1 },
        { left: 6, right: 2 },
      ],
      { north: 6, east: 6 },
    );

    const move = chooseBotMove(state, "A");

    expect(move.kind).toBe("play");
  });

  it("prioriza jogada com maior pontuação imediata", () => {
    const state = createStateWithOpenEnds(
      [
        { left: 6, right: 1 }, // gera soma 5 (pontua)
        { left: 6, right: 5 }, // gera soma 9 (não pontua)
      ],
      { north: 6, east: 2, south: 1, west: 1 },
    );

    const move = chooseBotMove(state, "A");

    expect(move).toMatchObject({
      kind: "play",
      phase: "end",
      piece: { left: 6, right: 1 },
    });
  });

  it("desempata por peça de maior valor total", () => {
    const state = createStateWithOpenEnds(
      [
        { left: 6, right: 6 },
        { left: 6, right: 5 },
      ],
      { north: 6, south: 2, east: 1 },
    );

    const move = chooseBotMove(state, "A");

    expect(move).toMatchObject({
      kind: "play",
      phase: "end",
      piece: { left: 6, right: 6 },
    });
  });

  it("desempata de forma determinística em empate total", () => {
    const state = createStateWithOpenEnds(
      [
        { left: 6, right: 1 },
        { left: 5, right: 2 },
      ],
      { north: 6, east: 5 },
    );

    const move = chooseBotMove(state, "A");

    expect(move).toMatchObject({
      kind: "play",
      phase: "end",
      endSide: "north",
      piece: { left: 6, right: 1 },
    });
  });

  it("passa corretamente quando não há jogadas válidas", () => {
    const state = createStateWithOpenEnds(
      [
        { left: 0, right: 1 },
        { left: 2, right: 3 },
      ],
      { north: 6, east: 6, south: 6, west: 6 },
    );

    const move = chooseBotMove(state, "A");

    expect(move).toEqual({ kind: "pass", reason: "no_legal_moves" });
  });

  it("bloqueia o proximo adversario quando as jogadas empatam em pontuacao", () => {
    const state = createStateWithOpenEnds(
      [],
      { north: 6, south: 5 },
      {
        B: [
          { left: 6, right: 1 },
          { left: 5, right: 2 },
        ],
        C: [{ left: 6, right: 0 }],
      },
    );

    const move = chooseBotMove(state, "B", { turnOrder: ["A", "B", "C", "D"] });

    expect(move).toMatchObject({
      kind: "play",
      phase: "end",
      endSide: "north",
      piece: { left: 6, right: 1 },
    });
  });

  it("preserva opcoes para o parceiro quando nao perde pontuacao imediata", () => {
    const state = createStateWithOpenEnds(
      [],
      { north: 6, south: 5 },
      {
        B: [
          { left: 6, right: 1 },
          { left: 5, right: 2 },
        ],
        D: [{ left: 1, right: 4 }],
      },
    );

    const move = chooseBotMove(state, "B", { turnOrder: ["A", "B", "C", "D"] });

    expect(move).toMatchObject({
      kind: "play",
      phase: "end",
      endSide: "north",
      piece: { left: 6, right: 1 },
    });
  });

  it("evita deixar pontuacao imediata para o proximo adversario", () => {
    const state = createStateWithOpenEnds(
      [],
      { north: 6, south: 5 },
      {
        B: [
          { left: 6, right: 1 },
          { left: 5, right: 2 },
        ],
        C: [{ left: 1, right: 5 }],
      },
    );

    const move = chooseBotMove(state, "B", { turnOrder: ["A", "B", "C", "D"] });

    expect(move).toMatchObject({
      kind: "play",
      phase: "end",
      endSide: "south",
      piece: { left: 5, right: 2 },
    });
  });

  it("mantem mobilidade para uma jogada futura propria", () => {
    const state = createStateWithOpenEnds(
      [],
      { north: 6, south: 5 },
      {
        B: [
          { left: 6, right: 1 },
          { left: 5, right: 2 },
          { left: 1, right: 3 },
        ],
      },
    );

    const move = chooseBotMove(state, "B", { turnOrder: ["A", "B", "C", "D"] });

    expect(move).toMatchObject({
      kind: "play",
      phase: "end",
      endSide: "north",
      piece: { left: 6, right: 1 },
    });
  });

  it("pode variar entre jogadas equivalentes quando recebe rng", () => {
    const state = createStateWithOpenEnds(
      [{ left: 6, right: 1 }],
      { north: 6, south: 6 },
    );

    const move = chooseBotMove(state, "A", {
      rng: () => 0.9,
      turnOrder: ["A", "B", "C", "D"],
    });

    expect(move).toMatchObject({
      kind: "play",
      phase: "end",
      endSide: "south",
      piece: { left: 6, right: 1 },
    });
  });

  it("prioriza uma oportunidade explicita de bonus de 50 pontos", () => {
    const state = createStateWithOpenEnds(
      [],
      { north: 6, south: 5 },
      {
        B: [
          { left: 6, right: 1 },
          { left: 5, right: 2 },
        ],
        C: [{ left: 1, right: 5 }],
      },
    );

    const move = chooseBotMove(state, "B", {
      bonusScoreOpportunity: 50,
      turnOrder: ["A", "B", "C", "D"],
    });

    expect(move.kind).toBe("play");
  });
});
