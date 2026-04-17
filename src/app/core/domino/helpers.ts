import type { DominoTile, HandsByPlayer } from "./types";

// Responsabilidade: utilitários puros e reutilizáveis do domínio.
export function isCarroca(tile: DominoTile): boolean {
  return tile.left === tile.right;
}

export function tileKey(tile: DominoTile): string {
  return `${tile.left}-${tile.right}`;
}

export function hasTile(hand: readonly DominoTile[], target: DominoTile): boolean {
  return hand.some(
    (tile) => tile.left === target.left && tile.right === target.right,
  );
}

export function flattenHands(hands: HandsByPlayer): readonly DominoTile[] {
  return [...hands.A, ...hands.B, ...hands.C, ...hands.D];
}
