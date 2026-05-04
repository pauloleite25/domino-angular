import { Component, EventEmitter, HostListener, Input, Output } from "@angular/core";

@Component({
    selector: "app-mobile-reaction-menu",
    templateUrl: "./mobile-reaction-menu.component.html",
    styleUrl: "./mobile-reaction-menu.component.scss",
})
export class MobileReactionMenuComponent {
    @Input() reactionOptions: readonly string[] = [];
    @Output() sendReaction = new EventEmitter<string>();
    @Output() sendLaughReaction = new EventEmitter<void>();
    isOpen = false;

    @HostListener("document:click", ["$event"])
    handleDocumentClick(event: MouseEvent): void {
        if (!this.isOpen) {
            return;
        }

        if (event.target instanceof Element && event.target.closest("app-mobile-reaction-menu")) {
            return;
        }

        this.isOpen = false;
    }

    @HostListener("document:keydown.escape")
    handleEscapeKey(): void {
        this.isOpen = false;
    }

    toggleMenu(): void {
        this.isOpen = !this.isOpen;
    }

    emitReaction(emoji: string): void {
        this.isOpen = false;
        this.sendReaction.emit(emoji);
    }

    emitLaughReaction(): void {
        this.isOpen = false;
        this.sendLaughReaction.emit();
    }
}
