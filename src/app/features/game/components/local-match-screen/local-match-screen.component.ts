import { Component, DoCheck, OnDestroy } from "@angular/core";
import { tileKey } from "../../../../core/domino";
import type { BoardSide, DominoTile, LegalMove, PlayerId } from "../../../../core/domino";
import { LocalMatchService } from "../../services/local-match.service";

function isPlayableMove(move: LegalMove): move is Extract<LegalMove, { kind: "play" }> {
    return move.kind === "play";
}

function isPassMove(move: LegalMove): move is Extract<LegalMove, { kind: "pass" }> {
    return move.kind === "pass";
}

@Component({
    selector: "app-local-match-screen",
    templateUrl: "./local-match-screen.component.html",
    styleUrl: "./local-match-screen.component.scss",
})
export class LocalMatchScreenComponent implements DoCheck, OnDestroy {
    selectedTileKey: string | null = null;
    selectedEnd: BoardSide | null = null;
    turnSecondsLeft = 15;
    hasDismissedMatchModal = false;

    private timerId: number | null = null;
    private previousTurnKey = "";

    constructor(public match: LocalMatchService) {}

    ngDoCheck(): void {
        const turnKey = `${this.match.currentPlayer ?? "-"}-${this.match.roundState?.roundNumber ?? 0}-${this.match.isHumanTurn}`;
        if (turnKey === this.previousTurnKey) {
            return;
        }

        this.previousTurnKey = turnKey;
        this.resetHumanTimer();
    }

    ngOnDestroy(): void {
        this.clearHumanTimer();
    }

    get playableMoves(): readonly Extract<LegalMove, { kind: "play" }>[] {
        return this.match.humanLegalMoves.filter(isPlayableMove);
    }

    get humanPassMove(): Extract<LegalMove, { kind: "pass" }> | null {
        return this.match.humanLegalMoves.find(isPassMove) ?? null;
    }

    get canHumanPass(): boolean {
        return this.match.isHumanTurn && this.humanPassMove !== null;
    }

    get playableTileKeys(): ReadonlySet<string> {
        return new Set(this.playableMoves.map((move) => tileKey(move.piece)));
    }

    get selectedTileMoves(): readonly Extract<LegalMove, { kind: "play" }>[] {
        if (!this.selectedTileKey) {
            return [];
        }

        return this.playableMoves.filter((move) => tileKey(move.piece) === this.selectedTileKey);
    }

    get selectableEnds(): readonly BoardSide[] {
        return this.selectedTileMoves
            .filter((move): move is Extract<LegalMove, { kind: "play"; phase: "end" }> => move.phase === "end")
            .map((move) => move.endSide);
    }

    get moveOptionBySide(): Partial<Record<BoardSide, number>> {
        const options: Partial<Record<BoardSide, number>> = {};
        let count = 1;

        for (const move of this.selectedTileMoves) {
            if (move.phase !== "end" || options[move.endSide] !== undefined) {
                continue;
            }

            options[move.endSide] = count;
            count += 1;
        }

        return options;
    }

    get canOpenWithSelectedTile(): boolean {
        return this.selectedTileMoves.some((move) => move.phase === "opening");
    }

    get openingOrientation(): "horizontal" | "vertical" {
        const starter = this.match.roundStarter;
        if (!starter) {
            return "vertical";
        }

        return starter === "A" || starter === "C" ? "horizontal" : "vertical";
    }

    get selectionHint(): string {
        if (!this.match.hasMatch) {
            return "Clique em 'Nova partida' para iniciar.";
        }

        if (this.match.isMatchOver) {
            return "Partida encerrada. Voce pode visualizar a mesa final e o historico.";
        }

        if (this.match.isRoundOver) {
            return "Rodada encerrada. Confira os calculos e inicie a proxima rodada.";
        }

        if (!this.match.isHumanTurn) {
            return "";
        }

        if (!this.selectedTileKey) {
            return "Escolha uma peca para jogar.";
        }

        if (this.match.roundState?.board.openingCarroca === null && this.canOpenWithSelectedTile) {
            return "Passo 2: clique em 'Abrir mesa' para iniciar a rodada.";
        }

        if (this.selectableEnds.length > 0) {
            return "Passo 2: selecione uma ponta destacada em verde.";
        }

        return "Peca selecionada sem encaixe disponivel.";
    }

    get isCurrentPlayerA(): boolean {
        return this.match.currentPlayer === "A";
    }

    get isNextPlayerA(): boolean {
        return this.match.nextPlayer === "A";
    }

    get didAStartRound(): boolean {
        return this.match.roundState?.starter === "A";
    }

    playerOrCurrent(player: PlayerId | null): PlayerId {
        return player ?? this.match.currentPlayer ?? "A";
    }

    formatTilesForSummary(tiles: readonly DominoTile[]): string {
        if (tiles.length === 0) {
            return "sem pecas";
        }

        return tiles.map((tile) => `[${tile.left}|${tile.right}]`).join(" ");
    }

    handleSelectTile(tile: DominoTile): void {
        const key = tileKey(tile);
        this.selectedTileKey = this.selectedTileKey === key ? null : key;
        this.selectedEnd = null;
    }

    handleSelectEnd(side: BoardSide): void {
        this.selectedEnd = side;

        if (!this.selectedTileKey) {
            return;
        }

        const move = this.selectedTileMoves.find((candidate) => candidate.phase === "end" && candidate.endSide === side);
        if (!move) {
            return;
        }

        this.match.playHumanMove(move);
        this.clearSelection();
    }

    handlePlayOpening(): void {
        const openingMove = this.selectedTileMoves.find((candidate) => candidate.phase === "opening");
        if (!openingMove) {
            return;
        }

        this.match.playHumanMove(openingMove);
        this.clearSelection();
    }

    handlePassTurn(): void {
        if (!this.humanPassMove) {
            return;
        }

        this.match.playHumanMove(this.humanPassMove);
        this.clearSelection();
    }

    handleStartNewMatch(): void {
        this.hasDismissedMatchModal = false;
        this.clearSelection();
        this.match.startNewMatch();
    }

    private clearSelection(): void {
        this.selectedTileKey = null;
        this.selectedEnd = null;
    }

    private resetHumanTimer(): void {
        this.clearHumanTimer();
        this.turnSecondsLeft = 15;

        if (!this.match.hasMatch || !this.match.isHumanTurn) {
            return;
        }

        this.timerId = window.setInterval(() => {
            this.turnSecondsLeft = Math.max(0, this.turnSecondsLeft - 1);
        }, 1000);
    }

    private clearHumanTimer(): void {
        if (this.timerId === null) {
            return;
        }

        window.clearInterval(this.timerId);
        this.timerId = null;
    }
}
