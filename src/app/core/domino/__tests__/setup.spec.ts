import { describe, expect, it } from "vitest";
import type { HandsByPlayer } from "@/core/domino";
import {
  countCarrocas,
  dealTiles,
  findPlayerWithSixSix,
  generateTiles,
  needsRedistribution,
} from "@/core/domino";

// Responsabilidade: validar setup da rodada sem envolver regras de jogada.
describe("setup da engine regional", () => {
  it("gera 28 peças únicas", () => {
    const tiles = generateTiles();
    const uniqueKeys = new Set(tiles.map((tile) => `${tile.left}-${tile.right}`));

    expect(tiles).toHaveLength(28);
    expect(uniqueKeys.size).toBe(28);
  });

  it("distribui 7 peças para cada jogador", () => {
    const hands = dealTiles(generateTiles());

    expect(hands.A).toHaveLength(7);
    expect(hands.B).toHaveLength(7);
    expect(hands.C).toHaveLength(7);
    expect(hands.D).toHaveLength(7);
  });

  it("detecta necessidade de redistribuição com 5 carroças", () => {
    const hands: HandsByPlayer = {
      A: [
        { left: 0, right: 0 },
        { left: 1, right: 1 },
        { left: 2, right: 2 },
        { left: 3, right: 3 },
        { left: 4, right: 4 },
        { left: 0, right: 1 },
        { left: 1, right: 2 },
      ],
      B: [
        { left: 0, right: 2 },
        { left: 0, right: 3 },
        { left: 0, right: 4 },
        { left: 0, right: 5 },
        { left: 0, right: 6 },
        { left: 1, right: 3 },
        { left: 1, right: 4 },
      ],
      C: [
        { left: 1, right: 5 },
        { left: 1, right: 6 },
        { left: 2, right: 3 },
        { left: 2, right: 4 },
        { left: 2, right: 5 },
        { left: 2, right: 6 },
        { left: 3, right: 4 },
      ],
      D: [
        { left: 3, right: 5 },
        { left: 3, right: 6 },
        { left: 4, right: 5 },
        { left: 4, right: 6 },
        { left: 5, right: 5 },
        { left: 5, right: 6 },
        { left: 6, right: 6 },
      ],
    };

    expect(countCarrocas(hands.A)).toBe(5);
    expect(needsRedistribution(hands)).toBe(true);
  });

  it("encontra o jogador que possui 6-6", () => {
    const hands: HandsByPlayer = {
      A: [
        { left: 0, right: 0 },
        { left: 0, right: 1 },
        { left: 0, right: 2 },
        { left: 0, right: 3 },
        { left: 0, right: 4 },
        { left: 0, right: 5 },
        { left: 0, right: 6 },
      ],
      B: [
        { left: 1, right: 1 },
        { left: 1, right: 2 },
        { left: 1, right: 3 },
        { left: 1, right: 4 },
        { left: 1, right: 5 },
        { left: 1, right: 6 },
        { left: 2, right: 2 },
      ],
      C: [
        { left: 2, right: 3 },
        { left: 2, right: 4 },
        { left: 2, right: 5 },
        { left: 2, right: 6 },
        { left: 3, right: 3 },
        { left: 3, right: 4 },
        { left: 3, right: 5 },
      ],
      D: [
        { left: 3, right: 6 },
        { left: 4, right: 4 },
        { left: 4, right: 5 },
        { left: 4, right: 6 },
        { left: 5, right: 5 },
        { left: 5, right: 6 },
        { left: 6, right: 6 },
      ],
    };

    expect(findPlayerWithSixSix(hands)).toBe("D");
  });
});
