import {
    AfterViewInit,
    ChangeDetectorRef,
    Component,
    ElementRef,
    EventEmitter,
    Input,
    OnDestroy,
    Output,
    ViewChild,
} from "@angular/core";
import { getPlayableEnds } from "../../../../core/domino";
import type { BoardSide, BoardState, DominoTile, PlayerId, TeamId } from "../../../../core/domino";
import { getBoardLayout, LayoutTile } from "../../model/board-layout";

const TILE_LONG_SIDE_PX_DESKTOP = 160;
const TILE_LONG_SIDE_PX_MOBILE = 60;
const BOARD_EDGE_PADDING_PX_DESKTOP = 92;
const BOARD_EDGE_PADDING_PX_MOBILE = 51;
const BOARD_LAYOUT_MAX_X = 6;
const BOARD_LAYOUT_MAX_Y = 3;
const MARKER_TIP_OFFSET_UNITS = 0.45;
const MIN_BOARD_SCALE_DESKTOP = 0.01;
const MIN_BOARD_SCALE_MOBILE = 0.01;
const NEAR_DROP_TOLERANCE_DESKTOP = 1.25;
const NEAR_DROP_TOLERANCE_MOBILE = 1.65;
const BOARD_SAFE_INSET_PX = 8;

export type BoardPlayer = {
    readonly id: PlayerId;
    readonly name: string;
    readonly team: TeamId;
    readonly handCount: number;
    readonly isHuman: boolean;
    readonly isCurrent: boolean;
};

@Component({
    selector: "app-domino-board",
    templateUrl: "./domino-board.component.html",
    styleUrl: "./domino-board.component.scss",
})
export class DominoBoardComponent implements AfterViewInit, OnDestroy {
    @ViewChild("canvasViewport")
    private set canvasViewportRef(viewport: ElementRef<HTMLElement> | undefined) {
        this.resizeObserver?.disconnect();
        this.resizeObserver = null;
        this.canvasViewportElement = viewport?.nativeElement ?? null;
        this.updateMeasuredBoardViewport();

        if (typeof ResizeObserver === "undefined" || this.canvasViewportElement === null) {
            return;
        }

        this.resizeObserver = new ResizeObserver(() => {
            this.updateMeasuredBoardViewport();
        });
        this.resizeObserver.observe(this.canvasViewportElement);
    }

    @Input({ required: true }) board!: BoardState;
    @Input() players: readonly BoardPlayer[] = [];
    @Input() nextPlayer: PlayerId | null = null;
    @Input({ required: true }) starter!: PlayerId;
    @Input() openingOrientation: "horizontal" | "vertical" = "vertical";
    @Input({ required: true }) boardBranches!: Record<BoardSide, readonly DominoTile[]>;
    @Input() selectedEnd: BoardSide | null = null;
    @Input() selectableEnds: readonly BoardSide[] = [];
    @Input() moveOptionBySide: Partial<Record<BoardSide, number>> = {};
    @Input() canOpenWithSelectedTile = false;
    @Output() selectEnd = new EventEmitter<BoardSide>();
    @Output() playOpening = new EventEmitter<void>();
    @Output() dropOnEnds = new EventEmitter<readonly BoardSide[]>();
    @Output() dropOnOpening = new EventEmitter<void>();

    readonly sides: readonly BoardSide[] = ["north", "east", "south", "west"];
    private resizeObserver: ResizeObserver | null = null;
    private canvasViewportElement: HTMLElement | null = null;
    private measuredBoardViewportWidth = 0;
    private measuredBoardViewportHeight = 0;

    constructor(private readonly changeDetector: ChangeDetectorRef) {}

    ngAfterViewInit(): void {
        this.updateMeasuredBoardViewport();
    }

    ngOnDestroy(): void {
        this.resizeObserver?.disconnect();
    }

    get isMobileViewport(): boolean {
        return typeof window !== "undefined" && window.matchMedia("(max-width: 640px), (max-height: 520px)").matches;
    }

    get isMobileLandscapeViewport(): boolean {
        return typeof window !== "undefined" && window.matchMedia("(max-height: 520px) and (orientation: landscape)").matches;
    }

    get tileLongSidePx(): number {
        if (this.isMobileLandscapeViewport) {
            return TILE_LONG_SIDE_PX_DESKTOP;
        }

        return this.isMobileViewport ? TILE_LONG_SIDE_PX_MOBILE : TILE_LONG_SIDE_PX_DESKTOP;
    }

    private get boardEdgePaddingPx(): number {
        return this.isMobileViewport ? BOARD_EDGE_PADDING_PX_MOBILE : BOARD_EDGE_PADDING_PX_DESKTOP;
    }

    private get boardViewportWidth(): number {
        if (this.measuredBoardViewportWidth > 0) {
            return this.measuredBoardViewportWidth;
        }

        if (typeof window === "undefined") {
            return this.isMobileViewport ? 760 : 1380;
        }

        const fraction = this.isMobileViewport ? 0.97 : 0.9;
        return Math.max(260, Math.floor(window.innerWidth * fraction));
    }

    private get boardViewportHeight(): number {
        if (this.measuredBoardViewportHeight > 0) {
            return this.measuredBoardViewportHeight;
        }

        if (typeof window === "undefined") {
            return this.isMobileViewport ? 520 : 860;
        }

        const fraction = this.isMobileLandscapeViewport ? 0.84 : this.isMobileViewport ? 0.94 : 0.86;
        return Math.max(220, Math.floor(window.innerHeight * fraction));
    }

    private get minBoardScale(): number {
        return this.isMobileViewport ? MIN_BOARD_SCALE_MOBILE : MIN_BOARD_SCALE_DESKTOP;
    }

    get openingTile(): DominoTile | null {
        return this.board.openingCarroca;
    }

    get layout() {
        return this.openingTile
            ? getBoardLayout(this.openingTile, this.openingOrientation, this.boardBranches, {
                  maxX: BOARD_LAYOUT_MAX_X,
                  maxY: BOARD_LAYOUT_MAX_Y,
              })
            : null;
    }

    get layoutTiles(): readonly LayoutTile[] {
        return this.layout?.tiles ?? [];
    }

    get endPositionsBySide(): Record<BoardSide, { readonly x: number; readonly y: number }> {
        return (
            this.layout?.endPositions ?? {
                north: { x: 0, y: -1 },
                east: { x: 1, y: 0 },
                south: { x: 0, y: 1 },
                west: { x: -1, y: 0 },
            }
        );
    }

    get markerPositionsBySide(): Record<BoardSide, { readonly x: number; readonly y: number }> {
        return {
            north: {
                x: this.endPositionsBySide.north.x,
                y: this.endPositionsBySide.north.y + MARKER_TIP_OFFSET_UNITS,
            },
            east: {
                x: this.endPositionsBySide.east.x - MARKER_TIP_OFFSET_UNITS,
                y: this.endPositionsBySide.east.y,
            },
            south: {
                x: this.endPositionsBySide.south.x,
                y: this.endPositionsBySide.south.y - MARKER_TIP_OFFSET_UNITS,
            },
            west: {
                x: this.endPositionsBySide.west.x + MARKER_TIP_OFFSET_UNITS,
                y: this.endPositionsBySide.west.y,
            },
        };
    }

    get boardCanvasWidth(): number {
        const tileLongSidePx = this.tileLongSidePx;
        const maxTileX = this.layoutTiles.reduce(
            (maxValue, tile) =>
                Math.max(
                    maxValue,
                    Math.abs(tile.x) + this.tileHalfExtentUnits(tile.orientation, "east"),
                ),
            0,
        );
        const maxEndX = this.sides.reduce(
            (maxValue, side) => Math.max(maxValue, Math.abs(this.markerPositionsBySide[side].x)),
            0,
        );
        const boardHalfWidth =
            Math.max(maxTileX, maxEndX) * tileLongSidePx + this.boardEdgePaddingPx;
        return Math.max(this.isMobileViewport ? 420 : 760, Math.ceil(boardHalfWidth * 2));
    }

    get boardCanvasHeight(): number {
        const tileLongSidePx = this.tileLongSidePx;
        const maxTileY = this.layoutTiles.reduce(
            (maxValue, tile) =>
                Math.max(
                    maxValue,
                    Math.abs(tile.y) + this.tileHalfExtentUnits(tile.orientation, "south"),
                ),
            0,
        );
        const maxEndY = this.sides.reduce(
            (maxValue, side) => Math.max(maxValue, Math.abs(this.markerPositionsBySide[side].y)),
            0,
        );
        const boardHalfHeight =
            Math.max(maxTileY, maxEndY) * tileLongSidePx + this.boardEdgePaddingPx;
        return Math.max(this.isMobileViewport ? 320 : 520, Math.ceil(boardHalfHeight * 2));
    }

    get boardScale(): number {
        const availableWidth = Math.max(1, this.boardViewportWidth - BOARD_SAFE_INSET_PX * 2);
        const availableHeight = Math.max(1, this.boardViewportHeight - BOARD_SAFE_INSET_PX * 2);
        const fitScale = Math.min(availableWidth / this.boardCanvasWidth, availableHeight / this.boardCanvasHeight);
        return Math.max(this.minBoardScale, Math.min(1, fitScale));
    }

    get canvasShellStyle(): Record<string, string> {
        const scaledWidth = Math.ceil(this.boardCanvasWidth * this.boardScale);
        const scaledHeight = Math.ceil(this.boardCanvasHeight * this.boardScale);
        return {
            width: `${scaledWidth + 4}px`,
            height: `${scaledHeight + 4}px`,
        };
    }

    get canvasStyle(): Record<string, string> {
        return {
            width: `${this.boardCanvasWidth}px`,
            height: `${this.boardCanvasHeight}px`,
            transform: `translate(-50%, -50%) scale(${this.boardScale})`,
        };
    }

    get selectableCount(): number {
        return this.selectableEnds.length;
    }

    toBoardStyle(x: number, y: number): Record<string, string> {
        const left = this.boardCanvasWidth / 2 + x * this.tileLongSidePx;
        const top = this.boardCanvasHeight / 2 + y * this.tileLongSidePx;

        return {
            left: `${left}px`,
            top: `${top}px`,
            transform: "translate(-50%, -50%)",
        };
    }

    private tileHalfExtentUnits(orientation: LayoutTile["orientation"], side: BoardSide): number {
        const isHorizontal = orientation === "horizontal";
        if (side === "east" || side === "west") {
            return (isHorizontal ? 1 : 64 / 112) / 2;
        }

        return (isHorizontal ? 64 / 112 : 1) / 2;
    }

    private updateMeasuredBoardViewport(): void {
        if (this.canvasViewportElement === null) {
            return;
        }

        const rect = this.canvasViewportElement.getBoundingClientRect();
        const width = Math.floor(rect.width);
        const height = Math.floor(rect.height);
        if (width === this.measuredBoardViewportWidth && height === this.measuredBoardViewportHeight) {
            return;
        }

        this.measuredBoardViewportWidth = width;
        this.measuredBoardViewportHeight = height;
        this.changeDetector.detectChanges();
    }

    getPlayer(playerId: PlayerId): BoardPlayer | null {
        return this.players.find((player) => player.id === playerId) ?? null;
    }

    statusLabel(player: BoardPlayer): string | null {
        if (player.isCurrent) {
            return "VEZ";
        }

        return this.nextPlayer === player.id ? "PROXIMO" : null;
    }

    hiddenTiles(player: BoardPlayer): readonly number[] {
        return Array.from({ length: Math.max(0, Math.min(7, player.handCount)) }, (_, index) => index);
    }

    visualEndState(side: BoardSide): "available" | "occupied" | "blocked" {
        const end = this.board.ends[side];
        const playableEndSides = new Set(getPlayableEnds(this.board, this.starter).map((item) => item.side));

        if (!end.isOpen || end.openValue === null || !playableEndSides.has(side)) {
            return "blocked";
        }

        return end.branchLength > 0 ? "occupied" : "available";
    }

    isEndSelectable(side: BoardSide): boolean {
        return this.visualEndState(side) !== "blocked" && this.selectableEnds.includes(side);
    }

    private getTipTileId(side: BoardSide): string {
        const branchLength = this.boardBranches[side]?.length ?? 0;
        return branchLength > 0 ? `${side}-${branchLength - 1}` : "center";
    }

    targetSidesForTile(entry: LayoutTile): readonly BoardSide[] {
        return this.selectableEnds.filter((side) => this.getTipTileId(side) === entry.id);
    }

    isTilePlayableTarget(entry: LayoutTile): boolean {
        return this.targetSidesForTile(entry).length > 0;
    }

    isTileSelectedTarget(entry: LayoutTile): boolean {
        if (this.selectedEnd === null) {
            return false;
        }

        return this.getTipTileId(this.selectedEnd) === entry.id;
    }

    handleTileClick(entry: LayoutTile): void {
        const sides = this.targetSidesForTile(entry);
        if (sides.length === 1) {
            this.selectEnd.emit(sides[0]);
        }
    }

    handleTileEdgeClick(side: BoardSide, event: MouseEvent): void {
        event.stopPropagation();
        this.selectEnd.emit(side);
    }

    handleDragOver(event: DragEvent): void {
        event.preventDefault();
        if (event.dataTransfer) {
            event.dataTransfer.dropEffect = "move";
        }
    }

    handleTileDrop(entry: LayoutTile, event: DragEvent): void {
        event.preventDefault();
        event.stopPropagation();
        const sides = this.targetSidesForTile(entry);
        if (sides.length === 0) {
            return;
        }

        this.dropOnEnds.emit(sides);
    }

    handleBoardDrop(event: DragEvent): void {
        event.preventDefault();
        event.stopPropagation();

        const side = this.findNearbyDropSide(event);
        if (!side) {
            return;
        }

        this.dropOnEnds.emit([side]);
    }

    handleOpeningDrop(event: DragEvent): void {
        event.preventDefault();
        this.dropOnOpening.emit();
    }

    private findNearbyDropSide(event: DragEvent): BoardSide | null {
        if (this.selectableEnds.length === 0 || !(event.currentTarget instanceof HTMLElement)) {
            return null;
        }

        const canvasShell = event.currentTarget.querySelector(".canvas-shell");
        if (!(canvasShell instanceof HTMLElement)) {
            return null;
        }

        const shellRect = canvasShell.getBoundingClientRect();
        const scale = this.boardScale;
        if (scale <= 0) {
            return null;
        }

        const dropX = (event.clientX - shellRect.left) / scale;
        const dropY = (event.clientY - shellRect.top) / scale;
        const tolerance =
            this.tileLongSidePx * (this.isMobileViewport ? NEAR_DROP_TOLERANCE_MOBILE : NEAR_DROP_TOLERANCE_DESKTOP);

        let nearestSide: BoardSide | null = null;
        let nearestDistance = Number.POSITIVE_INFINITY;

        for (const side of this.selectableEnds) {
            const point = this.markerPositionsBySide[side];
            const targetX = this.boardCanvasWidth / 2 + point.x * this.tileLongSidePx;
            const targetY = this.boardCanvasHeight / 2 + point.y * this.tileLongSidePx;
            const distance = Math.hypot(dropX - targetX, dropY - targetY);

            if (distance < nearestDistance) {
                nearestDistance = distance;
                nearestSide = side;
            }
        }

        return nearestSide && nearestDistance <= tolerance ? nearestSide : null;
    }
}
