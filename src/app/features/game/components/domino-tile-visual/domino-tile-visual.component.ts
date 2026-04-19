import { Component, Input } from "@angular/core";

type DominoOrientation = "horizontal" | "vertical";
type PlayableStyle = "default" | "hand" | "board";

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
    private static nextVisualId = 0;

    @Input({ required: true }) left!: number;
    @Input({ required: true }) right!: number;
    @Input() orientation: DominoOrientation = "vertical";
    @Input() fixedLongSidePx?: number;
    @Input() selected = false;
    @Input() playable = false;
    @Input() disabled = false;
    @Input() playableStyle: PlayableStyle = "default";

    readonly pipRadius = 4.5;
    readonly visualId = `domino-${DominoTileVisualComponent.nextVisualId++}`;

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

    get cornerRadius(): number {
        return 9;
    }

    get shellGradientId(): string {
        return `${this.visualId}-shell-gradient`;
    }

    get pipGradientId(): string {
        return `${this.visualId}-pip-gradient`;
    }

    get tileShadowId(): string {
        return `${this.visualId}-tile-shadow`;
    }

    get dividerShadowId(): string {
        return `${this.visualId}-divider-shadow`;
    }

    get shellHighlightBox(): Box {
        if (this.isHorizontal) {
            return {
                x: this.width * 0.06,
                y: this.height * 0.08,
                width: this.width * 0.72,
                height: this.height * 0.17,
            };
        }

        return {
            x: this.width * 0.1,
            y: this.height * 0.05,
            width: this.width * 0.66,
            height: this.height * 0.12,
        };
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
        if (!this.playable) {
            return "#18181b";
        }

        if (this.playableStyle === "hand") {
            return "#166534";
        }

        if (this.playableStyle === "board") {
            return "#b45309";
        }

        return "#047857";
    }

    get fillColor(): string {
        if (this.selected) {
            return "#dbeafe";
        }
        if (!this.playable) {
            return "#ffffff";
        }

        if (this.playableStyle === "hand") {
            return "#dcfce7";
        }

        if (this.playableStyle === "board") {
            return "#fef3c7";
        }

        return "#ecfdf5";
    }

    get pipColor(): string {
        return this.disabled ? "#52525b" : "#09090b";
    }

    get dividerColor(): string {
        return this.disabled ? "#52525b" : "#111111";
    }

    get dividerStrokeWidth(): number {
        if (this.fixedLongSidePx !== undefined && this.fixedLongSidePx <= 56) {
            return 2.6;
        }

        return 2.2;
    }

    getPips(value: number, box: Box): readonly Point[] {
        const pattern =
            value === 6 && this.isHorizontal
                ? this.getSixHorizontalPattern()
                : this.getPipPattern(value);

        return pattern.map((point) => ({
            x: box.x + point.x * box.width,
            y: box.y + point.y * box.height,
        }));
    }

    private getSixHorizontalPattern(): readonly Point[] {
        return [
            { x: 0.24, y: 0.34 },
            { x: 0.5, y: 0.34 },
            { x: 0.76, y: 0.34 },
            { x: 0.24, y: 0.66 },
            { x: 0.5, y: 0.66 },
            { x: 0.76, y: 0.66 },
        ];
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
