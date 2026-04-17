import { Component, Input } from "@angular/core";
import type { PlayerId } from "../../../../core/domino";

@Component({
    selector: "app-turn-indicator",
    templateUrl: "./turn-indicator.component.html",
    styleUrl: "./turn-indicator.component.scss",
})
export class TurnIndicatorComponent {
    @Input({ required: true }) currentPlayer!: PlayerId;
    @Input({ required: true }) roundStarter!: PlayerId;
    @Input({ required: true }) nextPlayer!: PlayerId;
    @Input({ required: true }) isHumanTurn = false;
    @Input() isBotTurn = false;
    @Input() botThinkingPlayer: PlayerId | null = null;
    @Input() botActionCountdown: number | null = null;
    @Input() botDelaySeconds = 10;
    @Input({ required: true }) turnSecondsLeft = 15;
    @Input({ required: true }) turnDurationSeconds = 15;

    get progress(): number {
        const rawProgress = this.isBotTurn
            ? ((this.botActionCountdown ?? 0) / this.botDelaySeconds) * 100
            : (this.turnSecondsLeft / this.turnDurationSeconds) * 100;
        return Math.max(0, Math.min(100, rawProgress));
    }

    get secondsLabel(): number {
        return this.isBotTurn ? (this.botActionCountdown ?? 0) : this.turnSecondsLeft;
    }

    get statusText(): string {
        return this.isHumanTurn
            ? "Sua vez de jogar."
            : `Bot ${this.botThinkingPlayer ?? this.currentPlayer} pensando...`;
    }
}
