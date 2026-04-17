import { Component, EventEmitter, Input, Output } from "@angular/core";
import { tileKey } from "../../../../core/domino";
import type { DominoTile } from "../../../../core/domino";

@Component({
    selector: "app-player-hand",
    templateUrl: "./player-hand.component.html",
    styleUrl: "./player-hand.component.scss",
})
export class PlayerHandComponent {
    @Input() hand: readonly DominoTile[] = [];
    @Input() selectedTileKey: string | null = null;
    @Input() playableTileKeys: ReadonlySet<string> = new Set<string>();
    @Input() canInteract = false;
    @Input() isCurrentPlayerA = false;
    @Input() isNextPlayerA = false;
    @Input() didAStartRound = false;
    @Output() selectTile = new EventEmitter<DominoTile>();

    get playableCount(): number {
        return this.hand.filter((tile) => this.isPlayable(tile)).length;
    }

    get statusLabel(): string | null {
        if (this.isCurrentPlayerA) {
            return "VEZ";
        }

        return this.isNextPlayerA ? "PROXIMO" : null;
    }

    tileKey(tile: DominoTile): string {
        return tileKey(tile);
    }

    isPlayable(tile: DominoTile): boolean {
        return this.playableTileKeys.has(tileKey(tile));
    }
}
