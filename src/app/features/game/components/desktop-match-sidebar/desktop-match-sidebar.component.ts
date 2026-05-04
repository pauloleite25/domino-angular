import { Component, EventEmitter, Input, Output } from "@angular/core";
import type { PlayerId } from "../../../../core/domino";
import type { MoveHistoryEntry } from "../../services/local-match.service";

@Component({
    selector: "app-desktop-match-sidebar",
    templateUrl: "./desktop-match-sidebar.component.html",
    styleUrl: "./desktop-match-sidebar.component.scss",
})
export class DesktopMatchSidebarComponent {
    @Input({ required: true }) score!: { readonly AC: number; readonly BD: number };
    @Input({ required: true }) moveHistory!: readonly MoveHistoryEntry[];
    @Input() acLabel = "Dupla A/C";
    @Input() bdLabel = "Dupla B/D";
    @Input() canStartNextRound = false;
    @Input({ required: true }) currentPlayer!: PlayerId;
    @Input() currentPlayerName = "";
    @Input({ required: true }) roundStarter!: PlayerId;
    @Input() roundStarterName = "";
    @Input({ required: true }) nextPlayer!: PlayerId;
    @Input() nextPlayerName = "";
    @Input() isHumanTurn = false;
    @Input() isBotTurn = false;
    @Input() botThinkingPlayer: PlayerId | null = null;
    @Input() botActionCountdown: number | null = null;
    @Input() botDelaySeconds = 10;
    @Input() turnSecondsLeft = 15;
    @Input() turnDurationSeconds = 15;
    @Output() startNextRound = new EventEmitter<void>();
    @Output() leaveGame = new EventEmitter<void>();
    @Output() openHistory = new EventEmitter<void>();
}
