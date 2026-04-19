import { Component, EventEmitter, Input, Output } from "@angular/core";
import { tileKey } from "../../../../core/domino";
import type { DominoTile, PlayerId } from "../../../../core/domino";

@Component({
    selector: "app-player-hand",
    templateUrl: "./player-hand.component.html",
    styleUrl: "./player-hand.component.scss",
})
export class PlayerHandComponent {
    @Input() hand: readonly DominoTile[] = [];
    @Input() selectedTileKey: string | null = null;
    @Input() playableTileKeys: ReadonlySet<string> = new Set<string>();
    @Input() playerId: PlayerId = "A";
    @Input() playerName = "Voce";
    @Input() canInteract = false;
    @Input() isCurrentPlayer = false;
    @Input() isNextPlayer = false;
    @Input() didAStartRound = false;
    @Output() selectTile = new EventEmitter<DominoTile>();
    @Output() dragTileStart = new EventEmitter<string>();
    @Output() dragTileEnd = new EventEmitter<void>();
    private readonly mobileTileLongSidePx = 48;
    private readonly desktopTileLongSidePx = 128;

    get playableCount(): number {
        return this.hand.filter((tile) => this.isPlayable(tile)).length;
    }

    get statusLabel(): string | null {
        if (this.isCurrentPlayer) {
            return "VEZ";
        }

        return this.isNextPlayer ? "PROXIMO" : null;
    }

    get tileLongSidePx(): number {
        if (typeof window === "undefined") {
            return this.desktopTileLongSidePx;
        }

        return window.matchMedia("(max-width: 640px), (max-height: 520px)").matches
            ? this.mobileTileLongSidePx
            : this.desktopTileLongSidePx;
    }

    tileKey(tile: DominoTile): string {
        return tileKey(tile);
    }

    isPlayable(tile: DominoTile): boolean {
        return this.playableTileKeys.has(tileKey(tile));
    }

    handleDragStart(event: DragEvent, tile: DominoTile): void {
        if (!this.canInteract || !this.isPlayable(tile) || !event.dataTransfer) {
            event.preventDefault();
            return;
        }

        const key = tileKey(tile);
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", key);
        this.dragTileStart.emit(key);
    }

    handleDragEnd(): void {
        this.dragTileEnd.emit();
    }
}
