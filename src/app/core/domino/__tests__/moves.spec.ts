import { describe, expect, it } from "vitest";
import {
  canPass,
  createBoardWithOpeningCarroca,
  getLegalMoves,
  getPlayableEnds,
  orientPieceForEnd,
} from "@/core/domino";
import type { BoardSide, DominoTile, RoundState } from "@/core/domino";

function createState(
  board: RoundState["board"],
  handA: readonly DominoTile[],
  starter: RoundState["starter"] = "A",
): RoundState {
  return {
    roundNumber: 1,
    phase: "in_progress",
    board,
    hands: {
      A: handA,
      B: [],
      C: [],
      D: [],
    },
    starter,
    mustOpenWithCarroca: true,
    redealCount: 0,
  };
}

function createBoardWithSingleOpenSide(side: BoardSide): RoundState["board"] {
  const board = createBoardWithOpeningCarroca({ left: 6, right: 6 });

  return {
    ...board,
    placedTilesCount: 2,
    ends: {
      north: {
        ...board.ends.north,
        isOpen: side === "north",
        openValue: side === "north" ? (6 as const) : null,
        tipIsDouble: side === "north",
      },
      east: {
        ...board.ends.east,
        isOpen: side === "east",
        openValue: side === "east" ? (6 as const) : null,
        tipIsDouble: side === "east",
      },
      south: {
        ...board.ends.south,
        isOpen: side === "south",
        openValue: side === "south" ? (6 as const) : null,
        tipIsDouble: side === "south",
      },
      west: {
        ...board.ends.west,
        isOpen: side === "west",
        openValue: side === "west" ? (6 as const) : null,
        tipIsDouble: side === "west",
      },
    },
  };
}

describe("modelagem da mesa e jogadas validas", () => {
  it("permite jogar no 1o lado da carroca inicial", () => {
    const state = createState(createBoardWithSingleOpenSide("north"), [
      { left: 6, right: 1 },
    ]);
    const moves = getLegalMoves(state, "A");

    expect(moves).toHaveLength(1);
    expect(moves[0]).toMatchObject({ kind: "play", phase: "end", endSide: "north" });
  });

  it("permite jogar no 2o lado da carroca inicial", () => {
    const state = createState(
      createBoardWithSingleOpenSide("east"),
      [{ left: 6, right: 1 }],
      "B",
    );
    const moves = getLegalMoves(state, "A");

    expect(moves).toHaveLength(1);
    expect(moves[0]).toMatchObject({ kind: "play", phase: "end", endSide: "east" });
  });

  it("permite jogar no 3o lado da carroca inicial", () => {
    const state = createState(createBoardWithSingleOpenSide("south"), [
      { left: 6, right: 1 },
    ]);
    const moves = getLegalMoves(state, "A");

    expect(moves).toHaveLength(1);
    expect(moves[0]).toMatchObject({ kind: "play", phase: "end", endSide: "south" });
  });

  it("permite jogar no 4o lado da carroca inicial", () => {
    const state = createState(
      createBoardWithSingleOpenSide("west"),
      [{ left: 6, right: 1 }],
      "B",
    );
    const moves = getLegalMoves(state, "A");

    expect(moves).toHaveLength(1);
    expect(moves[0]).toMatchObject({ kind: "play", phase: "end", endSide: "west" });
  });

  it("na segunda jogada da rodada permite somente leste ou oeste", () => {
    const state = createState(createBoardWithOpeningCarroca({ left: 6, right: 6 }), [
      { left: 6, right: 1 },
    ]);
    const moves = getLegalMoves(state, "A").filter(
      (move) => move.kind === "play" && move.phase === "end",
    );

    expect(moves).toHaveLength(2);
    expect(moves).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ endSide: "east" }),
        expect.objectContaining({ endSide: "west" }),
      ]),
    );
    expect(moves).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ endSide: "north" }),
        expect.objectContaining({ endSide: "south" }),
      ]),
    );
  });

  it("mantem pontas abertas apos expansoes dos 4 lados iniciais", () => {
    const board = createBoardWithOpeningCarroca({ left: 6, right: 6 });
    const expandedBoard: RoundState["board"] = {
      ...board,
      placedTilesCount: 8,
      ends: {
        north: {
          ...board.ends.north,
          openValue: 1 as const,
          branchLength: 2,
          tipIsDouble: false,
          isOpen: true,
        },
        east: {
          ...board.ends.east,
          openValue: 2 as const,
          branchLength: 1,
          tipIsDouble: false,
          isOpen: true,
        },
        south: {
          ...board.ends.south,
          openValue: 3 as const,
          branchLength: 3,
          tipIsDouble: false,
          isOpen: true,
        },
        west: {
          ...board.ends.west,
          openValue: 4 as const,
          branchLength: 1,
          tipIsDouble: false,
          isOpen: true,
        },
      },
    };
    const state = createState(expandedBoard, [{ left: 4, right: 1 }]);
    const moves = getLegalMoves(state, "A");

    expect(getPlayableEnds(expandedBoard, "A")).toHaveLength(4);
    expect(moves).toHaveLength(2);
    expect(moves).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ endSide: "north" }),
        expect.objectContaining({ endSide: "west" }),
      ]),
    );
  });

  it("orienta a peca para encaixe", () => {
    const board = createBoardWithSingleOpenSide("north");
    const oriented = orientPieceForEnd({ left: 1, right: 6 }, board.ends.north);

    expect(oriented).toEqual({ left: 6, right: 1 });
  });

  it("retorna passe quando jogador nao possui jogadas validas", () => {
    const state = createState(createBoardWithOpeningCarroca({ left: 6, right: 6 }), [
      { left: 0, right: 1 },
      { left: 2, right: 3 },
    ]);
    const moves = getLegalMoves(state, "A");

    expect(moves).toEqual([{ kind: "pass", reason: "no_legal_moves" }]);
  });

  it("proibe passe voluntario quando existe jogada valida", () => {
    const state = createState(createBoardWithOpeningCarroca({ left: 6, right: 6 }), [
      { left: 6, right: 1 },
    ]);

    expect(canPass(state, "A")).toBe(false);
    expect(getLegalMoves(state, "A").some((move) => move.kind === "pass")).toBe(false);
  });

  it("bloqueia norte e sul ate leste e oeste terem ao menos uma peca", () => {
    const board = createBoardWithOpeningCarroca({ left: 6, right: 6 });
    const state = createState(
      {
        ...board,
        placedTilesCount: 3,
        ends: {
          north: {
            ...board.ends.north,
            openValue: 3,
            branchLength: 2,
            tipIsDouble: false,
            isOpen: true,
          },
          south: {
            ...board.ends.south,
            openValue: 6,
            branchLength: 0,
            tipIsDouble: true,
            isOpen: true,
          },
          east: {
            ...board.ends.east,
            openValue: 6,
            branchLength: 1,
            tipIsDouble: true,
            isOpen: true,
          },
          west: {
            ...board.ends.west,
            openValue: 6,
            branchLength: 0,
            tipIsDouble: true,
            isOpen: true,
          },
        },
      },
      [{ left: 6, right: 1 }],
    );

    const endMoves = getLegalMoves(state, "A").filter(
      (move) => move.kind === "play" && move.phase === "end",
    );

    expect(endMoves).toHaveLength(1);
    expect(endMoves[0]).toMatchObject({ endSide: "west" });
  });

  it("libera norte e sul depois que leste e oeste ja nasceram", () => {
    const board = createBoardWithOpeningCarroca({ left: 6, right: 6 });
    const state = createState(
      {
        ...board,
        placedTilesCount: 3,
        ends: {
          north: {
            ...board.ends.north,
            openValue: 6,
            branchLength: 0,
            tipIsDouble: true,
            isOpen: true,
          },
          south: {
            ...board.ends.south,
            openValue: 6,
            branchLength: 0,
            tipIsDouble: true,
            isOpen: true,
          },
          east: {
            ...board.ends.east,
            openValue: 1,
            branchLength: 1,
            tipIsDouble: false,
            isOpen: true,
          },
          west: {
            ...board.ends.west,
            openValue: 2,
            branchLength: 1,
            tipIsDouble: false,
            isOpen: true,
          },
        },
      },
      [{ left: 6, right: 3 }],
    );

    const endMoves = getLegalMoves(state, "A").filter(
      (move) => move.kind === "play" && move.phase === "end",
    );

    expect(endMoves).toHaveLength(2);
    expect(endMoves).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ endSide: "north" }),
        expect.objectContaining({ endSide: "south" }),
      ]),
    );
  });
});
