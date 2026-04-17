import { Component, EventEmitter, Input, Output } from "@angular/core";
import type { TeamId } from "../../../../core/domino";

@Component({
    selector: "app-match-result-modal",
    templateUrl: "./match-result-modal.component.html",
    styleUrl: "./match-result-modal.component.scss",
})
export class MatchResultModalComponent {
    @Input() open = false;
    @Input() winnerTeam: TeamId | null = null;
    @Input({ required: true }) score!: { readonly AC: number; readonly BD: number };
    @Output() viewFinal = new EventEmitter<void>();
    @Output() newMatch = new EventEmitter<void>();
}
