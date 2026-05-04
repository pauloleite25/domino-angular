import { Component, EventEmitter, Input, Output } from "@angular/core";

@Component({
    selector: "app-desktop-reaction-bar",
    templateUrl: "./desktop-reaction-bar.component.html",
    styleUrl: "./desktop-reaction-bar.component.scss",
})
export class DesktopReactionBarComponent {
    @Input() reactionOptions: readonly string[] = [];
    @Output() sendReaction = new EventEmitter<string>();
    @Output() sendLaughReaction = new EventEmitter<void>();
}
