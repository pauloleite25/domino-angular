import { Component, Input } from "@angular/core";

type DominoOrientation = "horizontal" | "vertical";

type Point = {
    readonly x: number;
    readonly y: number;
};

type Box = {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
};

const TILE_WIDTH = 64;
const TILE_HEIGHT = 112;

@Component({
    selector: "app-domino-tile-visual",
    templateUrl: "./domino-tile-visual.component.html",
    styleUrl: "./domino-tile-visual.component.scss",
})
export class DominoTileVisualComponent {
    @Input({ required: true }) left!: number;
    @Input({ required: true }) right!: number;
    @Input() orientation: DominoOrientation = "vertical";
    @Input() fixedLongSidePx?: number;
    @Input() selected = false;
    @Input() playable = false;
    @Input() disabled = false;

    readonly pipRadius = 4.5;

    get isHorizontal(): boolean {
        return this.orientation === "horizontal";
    }

    get width(): number {
        return this.isHorizontal ? TILE_HEIGHT : TILE_WIDTH;
    }

    get height(): number {
        return this.isHorizontal ? TILE_WIDTH : TILE_HEIGHT;
    }

    get viewBox(): string {
        return `0 0 ${this.width} ${this.height}`;
    }

    get svgStyle(): Record<string, string> {
        if (this.fixedLongSidePx === undefined) {
            return {};
        }

        const fixedShortSidePx = TILE_WIDTH / TILE_HEIGHT;
        return this.isHorizontal
            ? {
                  width: `${this.fixedLongSidePx}px`,
                  height: `${this.fixedLongSidePx * fixedShortSidePx}px`,
              }
            : {
                  width: `${this.fixedLongSidePx * fixedShortSidePx}px`,
                  height: `${this.fixedLongSidePx}px`,
              };
    }

    get firstHalf(): Box {
        return this.isHorizontal
            ? { x: 0, y: 0, width: this.width / 2, height: this.height }
            : { x: 0, y: 0, width: this.width, height: this.height / 2 };
    }

    get secondHalf(): Box {
        return this.isHorizontal
            ? { x: this.width / 2, y: 0, width: this.width / 2, height: this.height }
            : { x: 0, y: this.height / 2, width: this.width, height: this.height / 2 };
    }

    get strokeColor(): string {
        if (this.selected) {
            return "#1d4ed8";
        }
        return this.playable ? "#047857" : "#18181b";
    }

    get fillColor(): string {
        if (this.selected) {
            return "#dbeafe";
        }
        return this.playable ? "#ecfdf5" : "#ffffff";
    }

    get pipColor(): string {
        return this.disabled ? "#52525b" : "#09090b";
    }

    get dividerColor(): string {
        return this.disabled ? "#71717a" : "#3f3f46";
    }

    getPips(value: number, box: Box): readonly Point[] {
        return this.getPipPattern(value).map((point) => ({
            x: box.x + point.x * box.width,
            y: box.y + point.y * box.height,
        }));
    }

    private getPipPattern(value: number): readonly Point[] {
        const tl: Point = { x: 0.28, y: 0.28 };
        const tr: Point = { x: 0.72, y: 0.28 };
        const ml: Point = { x: 0.28, y: 0.5 };
        const mr: Point = { x: 0.72, y: 0.5 };
        const bl: Point = { x: 0.28, y: 0.72 };
        const br: Point = { x: 0.72, y: 0.72 };
        const c: Point = { x: 0.5, y: 0.5 };

        switch (value) {
            case 0:
                return [];
            case 1:
                return [c];
            case 2:
                return [tl, br];
            case 3:
                return [tl, c, br];
            case 4:
                return [tl, tr, bl, br];
            case 5:
                return [tl, tr, c, bl, br];
            case 6:
                return [tl, tr, ml, mr, bl, br];
            default:
                return [];
        }
    }
}
