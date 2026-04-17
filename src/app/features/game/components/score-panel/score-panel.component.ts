import { Component, Input } from "@angular/core";

@Component({
    selector: "app-score-panel",
    templateUrl: "./score-panel.component.html",
    styleUrl: "./score-panel.component.scss",
})
export class ScorePanelComponent {
    @Input({ required: true }) score!: { readonly AC: number; readonly BD: number };

    get leader(): string {
        if (this.score.AC === this.score.BD) {
            return "Empate";
        }

        return this.score.AC > this.score.BD ? "A/C na frente" : "B/D na frente";
    }
}
