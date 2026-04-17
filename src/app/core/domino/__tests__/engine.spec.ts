import { describe, expect, it } from "vitest";
import { startMatch } from "@/core/domino/engine";

// Responsabilidade: proteger contratos mínimos da engine antes da lógica real.
describe("startMatch", () => {
  it("inicia um estado base válido para o MVP", () => {
    const state = startMatch();

    expect(state.phase).toBe("setup");
    expect(state.board).toEqual([]);
    expect(state.boneyardCount).toBe(0);
    expect(state.turn).toBe("player");
  });
});
