import { Component, EventEmitter, Input, Output } from "@angular/core";
import { getPlayableEnds } from "../../../../core/domino";
import type { BoardSide, BoardState, DominoTile, PlayerId, TeamId } from "../../../../core/domino";
import { getBoardLayout, LayoutTile } from "../../model/board-layout";

const TILE_LONG_SIDE_PX = 62;
const BOARD_EDGE_PADDING_PX = 80;
const MARKER_TIP_OFFSET_UNITS = 0.45;
const BOARD_VIEWPORT_WIDTH = 1380;
const BOARD_VIEWPORT_HEIGHT = 860;
const MIN_BOARD_SCALE = 0.8;

type EndMarker = {
    readonly side: BoardSide;
    readonly x: number;
    readonly y: number;
    readonly optionNumber: number | null;
};

export type BoardPlayer = {
    readonly id: PlayerId;
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
export class DominoBoardComponent {
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

    readonly tileLongSidePx = TILE_LONG_SIDE_PX;
    readonly sides: readonly BoardSide[] = ["north", "east", "south", "west"];

    get openingTile(): DominoTile | null {
        return this.board.openingCarroca;
    }

    get layout() {
        return this.openingTile
            ? getBoardLayout(this.openingTile, this.openingOrientation, this.boardBranches, { maxX: 6, maxY: 3 })
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
        const maxTileX = this.layoutTiles.reduce((maxValue, tile) => Math.max(maxValue, Math.abs(tile.x)), 0);
        const maxEndX = this.sides.reduce(
            (maxValue, side) => Math.max(maxValue, Math.abs(this.markerPositionsBySide[side].x)),
            0,
        );
        const boardHalfWidth =
            Math.max(maxTileX, maxEndX) * TILE_LONG_SIDE_PX + TILE_LONG_SIDE_PX / 2 + BOARD_EDGE_PADDING_PX;
        return Math.max(760, Math.ceil(boardHalfWidth * 2));
    }

    get boardCanvasHeight(): number {
        const maxTileY = this.layoutTiles.reduce((maxValue, tile) => Math.max(maxValue, Math.abs(tile.y)), 0);
        const maxEndY = this.sides.reduce(
            (maxValue, side) => Math.max(maxValue, Math.abs(this.markerPositionsBySide[side].y)),
            0,
        );
        const boardHalfHeight =
            Math.max(maxTileY, maxEndY) * TILE_LONG_SIDE_PX + TILE_LONG_SIDE_PX / 2 + BOARD_EDGE_PADDING_PX;
        return Math.max(520, Math.ceil(boardHalfHeight * 2));
    }

    get boardScale(): number {
        return Math.max(
            MIN_BOARD_SCALE,
            Math.min(1, BOARD_VIEWPORT_WIDTH / this.boardCanvasWidth, BOARD_VIEWPORT_HEIGHT / this.boardCanvasHeight),
        );
    }

    get canvasShellStyle(): Record<string, string> {
        return {
            width: `${Math.ceil(this.boardCanvasWidth * this.boardScale)}px`,
            height: `${Math.ceil(this.boardCanvasHeight * this.boardScale)}px`,
        };
    }

    get canvasStyle(): Record<string, string> {
        return {
            width: `${this.boardCanvasWidth}px`,
            height: `${this.boardCanvasHeight}px`,
            transform: `translate(-50%, -50%) scale(${this.boardScale})`,
        };
    }

    get endMarkers(): readonly EndMarker[] {
        return this.sides.map((side) => ({
            side,
            x: this.markerPositionsBySide[side].x,
            y: this.markerPositionsBySide[side].y,
            optionNumber: this.moveOptionBySide[side] ?? null,
        }));
    }

    get selectableCount(): number {
        return this.selectableEnds.length;
    }

    toBoardStyle(x: number, y: number): Record<string, string> {
        const left = this.boardCanvasWidth / 2 + x * TILE_LONG_SIDE_PX;
        const top = this.boardCanvasHeight / 2 + y * TILE_LONG_SIDE_PX;

        return {
            left: `${left}px`,
            top: `${top}px`,
            transform: "translate(-50%, -50%)",
        };
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
}
