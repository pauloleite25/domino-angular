import { AfterViewChecked, Component, ElementRef, Input, ViewChild } from "@angular/core";
import type { MoveHistoryEntry } from "../../services/local-match.service";

type RoundGroup = {
    readonly roundNumber: number;
    readonly items: readonly MoveHistoryEntry[];
};

@Component({
    selector: "app-move-history",
    templateUrl: "./move-history.component.html",
    styleUrl: "./move-history.component.scss",
})
export class MoveHistoryComponent implements AfterViewChecked {
    @Input() items: readonly MoveHistoryEntry[] = [];
    @ViewChild("list") list?: ElementRef<HTMLDivElement>;

    private lastLength = 0;

    get groupedByRound(): readonly RoundGroup[] {
        const groups = new Map<number, MoveHistoryEntry[]>();
        for (const item of this.items) {
            const current = groups.get(item.roundNumber) ?? [];
            current.push(item);
            groups.set(item.roundNumber, current);
        }

        return Array.from(groups.entries()).map(([roundNumber, roundItems]) => ({
            roundNumber,
            items: roundItems,
        }));
    }

    ngAfterViewChecked(): void {
        if (this.items.length === this.lastLength || !this.list) {
            return;
        }

        this.lastLength = this.items.length;
        const element = this.list.nativeElement;
        element.scrollTop = element.scrollHeight;
    }
}
