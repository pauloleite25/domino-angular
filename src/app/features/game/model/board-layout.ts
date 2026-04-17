import type { BoardSide, DominoTile } from "../../../core/domino";

export type LayoutOrientation = "horizontal" | "vertical";

export type LayoutTile = {
  readonly id: string;
  readonly tile: DominoTile;
  readonly x: number;
  readonly y: number;
  readonly orientation: LayoutOrientation;
  readonly branch: BoardSide | "center";
};

export type BranchTiles = Record<BoardSide, readonly DominoTile[]>;

export type BoardLayoutBounds = {
  readonly maxX: number;
  readonly maxY: number;
};

export type BoardLayoutResult = {
  readonly tiles: readonly LayoutTile[];
  readonly endPositions: Record<BoardSide, { readonly x: number; readonly y: number }>;
};

type GridPoint = {
  readonly x: number;
  readonly y: number;
};

const TILE_SHORT_RATIO = 64 / 112;

const BRANCH_FLOW: Record<
  BoardSide,
  { readonly primary: BoardSide; readonly secondary: BoardSide }
> = {
  north: { primary: "north", secondary: "east" },
  south: { primary: "south", secondary: "west" },
  east: { primary: "east", secondary: "south" },
  west: { primary: "west", secondary: "north" },
};

const SIDE_DELTA: Record<BoardSide, { readonly dx: number; readonly dy: number }> = {
  north: { dx: 0, dy: -1 },
  east: { dx: 1, dy: 0 },
  south: { dx: 0, dy: 1 },
  west: { dx: -1, dy: 0 },
};

function isDouble(tile: DominoTile): boolean {
  return tile.left === tile.right;
}

function flipTile(tile: DominoTile): DominoTile {
  return { left: tile.right, right: tile.left };
}

function sideToOrientation(side: BoardSide): LayoutOrientation {
  return side === "east" || side === "west" ? "horizontal" : "vertical";
}

function getBranchOrientation(side: BoardSide, tile: DominoTile): LayoutOrientation {
  const base = sideToOrientation(side);
  if (!isDouble(tile)) {
    return base;
  }

  return base === "horizontal" ? "vertical" : "horizontal";
}

function getDisplayTileForDirection(side: BoardSide, tile: DominoTile): DominoTile {
  if (side === "north" || side === "west") {
    return flipTile(tile);
  }

  return tile;
}

function getTileExtentOnSide(
  orientation: LayoutOrientation,
  side: BoardSide,
): number {
  const isHorizontal = orientation === "horizontal";

  if (side === "east" || side === "west") {
    return isHorizontal ? 1 : TILE_SHORT_RATIO;
  }

  return isHorizontal ? TILE_SHORT_RATIO : 1;
}

function moveByDistance(
  point: GridPoint,
  side: BoardSide,
  distance: number,
): GridPoint {
  const delta = SIDE_DELTA[side];

  return {
    x: point.x + delta.dx * distance,
    y: point.y + delta.dy * distance,
  };
}

function shouldStayOnPrimaryAxis(
  placedOnPrimary: readonly DominoTile[],
  currentTile: DominoTile,
): boolean {
  if (placedOnPrimary.length < 4) {
    return true;
  }

  if (placedOnPrimary.length > 4) {
    return false;
  }

  const hasDoubleAmongFirstFour = placedOnPrimary.some((tile) => isDouble(tile));
  return hasDoubleAmongFirstFour || isDouble(currentTile);
}

function getTurningTilePosition(
  previousPosition: GridPoint,
  previousOrientation: LayoutOrientation,
  currentOrientation: LayoutOrientation,
  primaryDirection: BoardSide,
  secondaryDirection: BoardSide,
): GridPoint {
  const primaryDistance =
    getTileExtentOnSide(previousOrientation, primaryDirection) / 2 +
    getTileExtentOnSide(currentOrientation, primaryDirection) / 2;
  const secondaryDistance =
    getTileExtentOnSide(currentOrientation, secondaryDirection) / 4;

  return moveByDistance(
    moveByDistance(previousPosition, primaryDirection, primaryDistance),
    secondaryDirection,
    secondaryDistance,
  );
}

export function getBoardLayout(
  openingTile: DominoTile,
  openingOrientation: LayoutOrientation,
  branches: BranchTiles,
  bounds: BoardLayoutBounds = { maxX: 6, maxY: 3 },
): BoardLayoutResult {
  void bounds;
  const tiles: LayoutTile[] = [
    {
      id: "center",
      tile: openingTile,
      x: 0,
      y: 0,
      orientation: openingOrientation,
      branch: "center",
    },
  ];

  const endPositions: Record<BoardSide, { x: number; y: number }> = {
    north: { x: 0, y: -1 },
    east: { x: 1, y: 0 },
    south: { x: 0, y: 1 },
    west: { x: -1, y: 0 },
  };

  (["north", "east", "south", "west"] as const).forEach((branchSide) => {
    const flow = BRANCH_FLOW[branchSide];
    const branchTiles = branches[branchSide];

    let previousPosition: GridPoint = { x: 0, y: 0 };
    let previousOrientation: LayoutOrientation = openingOrientation;
    let currentDirection: BoardSide = flow.primary;
    let hasTurned = false;
    const placedOnPrimary: DominoTile[] = [];

    for (let index = 0; index < branchTiles.length; index += 1) {
      const sourceTile = branchTiles[index];
      let turningThisTile = false;

      if (!hasTurned) {
        if (!shouldStayOnPrimaryAxis(placedOnPrimary, sourceTile)) {
          if (isDouble(sourceTile)) {
            currentDirection = flow.primary;
            hasTurned = true;
          } else {
            const previousPrimaryTile =
              placedOnPrimary.length > 0
                ? placedOnPrimary[placedOnPrimary.length - 1]
                : null;
            hasTurned = true;
            currentDirection = flow.secondary;
            if (previousPrimaryTile === null || !isDouble(previousPrimaryTile)) {
              turningThisTile = true;
            }
          }
        } else {
          currentDirection = flow.primary;
        }
      } else {
        currentDirection = flow.secondary;
      }

      const displayTile = getDisplayTileForDirection(currentDirection, sourceTile);
      const currentOrientation = getBranchOrientation(currentDirection, displayTile);

      const currentPosition = turningThisTile
        ? getTurningTilePosition(
            previousPosition,
            previousOrientation,
            currentOrientation,
            flow.primary,
            flow.secondary,
          )
        : (() => {
            const prevExtent = getTileExtentOnSide(previousOrientation, currentDirection);
            const currExtent = getTileExtentOnSide(currentOrientation, currentDirection);
            const distance = (prevExtent + currExtent) / 2;
            return moveByDistance(previousPosition, currentDirection, distance);
          })();

      tiles.push({
        id: `${branchSide}-${index}`,
        tile: displayTile,
        x: currentPosition.x,
        y: currentPosition.y,
        orientation: currentOrientation,
        branch: branchSide,
      });

      if (!hasTurned && currentDirection === flow.primary) {
        placedOnPrimary.push(sourceTile);
      }

      previousPosition = currentPosition;
      previousOrientation = currentOrientation;
    }

    endPositions[branchSide] = moveByDistance(previousPosition, currentDirection, 1);
  });

  return { tiles, endPositions };
}
