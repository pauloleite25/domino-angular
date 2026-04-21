import { Injectable, OnDestroy } from "@angular/core";
import {
    applyRoundEnd,
    chooseBotMove,
    createBoardWithOpeningCarroca,
    createInitialMatchState,
    createNextRound,
    getLegalMoves,
    getMatchWinner,
    getPassPenalty,
    getPassPenaltyAwardedTeam,
    getRoundResult,
    getScoreForPlayedMove,
    getTeamByPlayer,
    isDouble,
    isMatchOver,
    roundDownToNearestFive,
    sumHand,
    sumTeamHands,
} from "../../../core/domino";
import type {
    BoardSide,
    DominoTile,
    LegalMove,
    MatchState,
    PlayerId,
    RoundResult,
    RoundState,
    TeamId,
} from "../../../core/domino";

export type BoardBranches = Record<BoardSide, readonly DominoTile[]>;
export type PlayerNames = Partial<Record<PlayerId, string>>;

export type MoveHistoryEntry = {
    readonly id: number;
    readonly roundNumber: number;
    readonly playerId: PlayerId;
    readonly description: string;
    readonly points: number;
};

export type RoundEndSummary = {
    readonly roundNumber: number;
    readonly reason: RoundResult["reason"];
    readonly winnerTeam: TeamId | null;
    readonly winnerPlayer: PlayerId | null;
    readonly pointsAwarded: number;
    readonly loserTeam: TeamId | null;
    readonly loserHands: readonly {
        readonly playerId: PlayerId;
        readonly tiles: readonly DominoTile[];
        readonly total: number;
    }[];
    readonly totals: {
        readonly AC: number;
        readonly BD: number;
    };
    readonly roundedFrom: number;
    readonly roundedTo: number;
};

type PassChainState = {
    readonly afterPlayBy: PlayerId;
    readonly passers: readonly PlayerId[];
    readonly firstPassAwardedTeam: TeamId | null;
    readonly firstPassPoints: number;
};

type TurnEvent =
    | {
          readonly type: "pass";
          readonly playerId: PlayerId;
          readonly awardedTeam: TeamId | null;
          readonly points: number;
      }
    | {
          readonly type: "score";
          readonly playerId: PlayerId;
          readonly team: TeamId;
          readonly points: number;
      }
    | {
          readonly type: "play";
          readonly playerId: PlayerId;
      };

export type RecentTurnEvent = TurnEvent;

export type RecentReaction = {
    readonly id: number;
    readonly playerId: PlayerId;
    readonly emoji: string;
    readonly sound: "none" | "laugh";
};

export type GaloPopup = {
    readonly id: number;
    readonly playerId: PlayerId;
    readonly team: TeamId;
    readonly points: number;
};

type LocalMatchState = {
    readonly humanPlayers: readonly PlayerId[];
    readonly playerNames: PlayerNames;
    readonly match: MatchState | null;
    readonly boardBranches: BoardBranches;
    readonly moveHistory: readonly MoveHistoryEntry[];
    readonly currentPlayer: PlayerId | null;
    readonly pendingNextMatch: MatchState | null;
    readonly lastActedPlayer: PlayerId | null;
    readonly lastPlayedPlayer: PlayerId | null;
    readonly passChain: PassChainState | null;
    readonly lastPassPlayer: PlayerId | null;
    readonly lastRoundResult: RoundResult | null;
    readonly roundEndSummary: RoundEndSummary | null;
    readonly recentEvent: TurnEvent | null;
    readonly recentReaction: RecentReaction | null;
    readonly galoPopup: GaloPopup | null;
};

type ActiveLocalMatchState = Omit<LocalMatchState, "match" | "currentPlayer"> & {
    readonly match: MatchState;
    readonly currentPlayer: PlayerId;
};

type NetworkConfig = {
    readonly roomId: string;
    readonly role: PlayerId;
    readonly humanPlayers: readonly PlayerId[];
    readonly playerNames: PlayerNames;
    readonly isHost: boolean;
    readonly apiBase: string;
};

type NetworkCommand =
    | {
          readonly id: number;
          readonly playerId: PlayerId;
          readonly action?: "move";
          readonly move: LegalMove;
      }
    | {
          readonly id: number;
          readonly playerId: PlayerId;
          readonly action: "reaction";
          readonly emoji: string;
          readonly sound?: "none" | "laugh";
      };

type NetworkRoomPayload = {
    readonly exists?: boolean;
    readonly room?: {
        readonly humanPlayers?: readonly PlayerId[];
        readonly playerNames?: PlayerNames;
    } | null;
};

export type PlayerView = {
    readonly id: PlayerId;
    readonly name: string;
    readonly team: TeamId;
    readonly handCount: number;
    readonly isHuman: boolean;
    readonly isCurrent: boolean;
};

const HUMAN_PLAYER: PlayerId = "A";
const SIMULATE_ALL_BOTS = false;
const TURN_ORDER: readonly PlayerId[] = ["A", "B", "C", "D"];
const BOT_MOVE_DELAY_MS = 2000;
const GALO_BONUS_POINTS = 50;
const CARROCA_BATIDA_BONUS_POINTS = 20;

function formatTileForHistory(tile: DominoTile): string {
    return `[${tile.left}|${tile.right}]`;
}

function createEmptyBoardBranches(): BoardBranches {
    return {
        north: [],
        east: [],
        south: [],
        west: [],
    };
}

function nextTurn(playerId: PlayerId): PlayerId {
    const index = TURN_ORDER.indexOf(playerId);
    const nextIndex = (index + 1) % TURN_ORDER.length;
    return TURN_ORDER[nextIndex];
}

function mergePlayerIds(...groups: readonly (readonly PlayerId[])[]): readonly PlayerId[] {
    const players = new Set(groups.flat());
    return TURN_ORDER.filter((playerId) => players.has(playerId));
}

function isPlaceholderPlayerName(playerId: PlayerId, name: string): boolean {
    return name.trim().toLowerCase() === `jogador ${playerId.toLowerCase()}`;
}

function getPlayerTeam(playerId: PlayerId): TeamId {
    return playerId === "A" || playerId === "C" ? "AC" : "BD";
}

function getOpponentTeam(teamId: TeamId): TeamId {
    return teamId === "AC" ? "BD" : "AC";
}

function addPoints(score: MatchState["score"], team: TeamId | null, points: number) {
    if (points <= 0 || team === null) {
        return score;
    }

    if (team === "AC") {
        return { AC: score.AC + points, BD: score.BD };
    }

    return { AC: score.AC, BD: score.BD + points };
}

function subtractPoints(score: MatchState["score"], team: TeamId | null, points: number) {
    if (points <= 0 || team === null) {
        return score;
    }

    if (team === "AC") {
        return { AC: Math.max(0, score.AC - points), BD: score.BD };
    }

    return { AC: score.AC, BD: Math.max(0, score.BD - points) };
}

function samePiece(left: { left: number; right: number }, right: { left: number; right: number }) {
    return left.left === right.left && left.right === right.right;
}

function sameMove(a: LegalMove, b: LegalMove): boolean {
    if (a.kind !== b.kind) {
        return false;
    }

    if (a.kind === "pass" && b.kind === "pass") {
        return true;
    }

    if (a.kind === "play" && b.kind === "play") {
        if (a.phase !== b.phase || !samePiece(a.piece, b.piece)) {
            return false;
        }

        if (a.phase === "opening") {
            return true;
        }

        if (a.phase !== "end" || b.phase !== "end") {
            return false;
        }

        return a.endSide === b.endSide && samePiece(a.orientedPiece, b.orientedPiece);
    }

    return false;
}

function removePieceFromHand(
    hand: readonly RoundState["hands"]["A"][number][],
    piece: RoundState["hands"]["A"][number],
) {
    let removed = false;

    return hand.filter((tile) => {
        if (!removed && samePiece(tile, piece)) {
            removed = true;
            return false;
        }

        return true;
    });
}

function applyMoveToRound(round: RoundState, playerId: PlayerId, move: LegalMove): RoundState {
    if (move.kind === "pass") {
        return {
            ...round,
            phase: "in_progress",
        };
    }

    const updatedHands = {
        ...round.hands,
        [playerId]: removePieceFromHand(round.hands[playerId], move.piece),
    };

    if (move.phase === "opening") {
        return {
            ...round,
            phase: "in_progress",
            hands: updatedHands,
            board: createBoardWithOpeningCarroca(move.piece),
        };
    }

    const currentEnd = round.board.ends[move.endSide];
    if (!currentEnd.isOpen || currentEnd.openValue === null) {
        return round;
    }

    return {
        ...round,
        phase: "in_progress",
        hands: updatedHands,
        board: {
            ...round.board,
            placedTilesCount: round.board.placedTilesCount + 1,
            ends: {
                ...round.board.ends,
                [move.endSide]: {
                    ...currentEnd,
                    openValue: move.orientedPiece.right,
                    branchLength: currentEnd.branchLength + 1,
                    tipIsDouble: isDouble(move.orientedPiece),
                    isOpen: true,
                },
            },
        },
    };
}

function getRoundEndSummary(round: RoundState, result: RoundResult): RoundEndSummary {
    const totals = {
        AC: sumTeamHands(round, "AC"),
        BD: sumTeamHands(round, "BD"),
    };

    if (result.winnerTeam === null) {
        return {
            roundNumber: round.roundNumber,
            reason: result.reason,
            winnerTeam: null,
            winnerPlayer: result.winnerPlayer,
            pointsAwarded: 0,
            loserTeam: null,
            loserHands: [],
            totals,
            roundedFrom: 0,
            roundedTo: 0,
        };
    }

    const loserTeam = getOpponentTeam(result.winnerTeam);
    const loserPlayers: readonly PlayerId[] = loserTeam === "AC" ? ["A", "C"] : ["B", "D"];
    const loserHands = loserPlayers.map((playerId) => ({
        playerId,
        tiles: round.hands[playerId],
        total: sumHand(round.hands[playerId]),
    }));

    const roundedFrom =
        result.reason === "batida"
            ? loserHands.reduce((sum, hand) => sum + hand.total, 0)
            : Math.abs(totals.AC - totals.BD);

    return {
        roundNumber: round.roundNumber,
        reason: result.reason,
        winnerTeam: result.winnerTeam,
        winnerPlayer: result.winnerPlayer,
        pointsAwarded: result.points,
        loserTeam,
        loserHands,
        totals,
        roundedFrom,
        roundedTo: roundDownToNearestFive(roundedFrom),
    };
}

function buildInitialLocalState(): LocalMatchState {
    return {
        humanPlayers: [HUMAN_PLAYER],
        playerNames: {},
        match: null,
        boardBranches: createEmptyBoardBranches(),
        moveHistory: [],
        currentPlayer: null,
        pendingNextMatch: null,
        lastActedPlayer: null,
        lastPlayedPlayer: null,
        passChain: null,
        lastPassPlayer: null,
        lastRoundResult: null,
        roundEndSummary: null,
        recentEvent: null,
        recentReaction: null,
        galoPopup: null,
    };
}

function createFreshLocalState(humanPlayers: readonly PlayerId[], playerNames: PlayerNames): ActiveLocalMatchState {
    const match = createInitialMatchState();
    return {
        humanPlayers,
        playerNames,
        match,
        boardBranches: createEmptyBoardBranches(),
        moveHistory: [],
        currentPlayer: match.currentRound.starter,
        pendingNextMatch: null,
        lastActedPlayer: null,
        lastPlayedPlayer: null,
        passChain: null,
        lastPassPlayer: null,
        lastRoundResult: null,
        roundEndSummary: null,
        recentEvent: null,
        recentReaction: null,
        galoPopup: null,
    };
}

function isActiveState(state: LocalMatchState): state is ActiveLocalMatchState {
    return state.match !== null && state.currentPlayer !== null;
}

@Injectable({
    providedIn: "root",
})
export class LocalMatchService implements OnDestroy {
    private state: LocalMatchState = buildInitialLocalState();
    private networkConfig = this.readNetworkConfig();
    private botTimeoutId: number | null = null;
    private botIntervalId: number | null = null;
    private networkIntervalId: number | null = null;
    private lastNetworkCommandId = 0;
    private lastSnapshotVersion = 0;

    botActionCountdown: number | null = null;

    constructor() {
        void this.refreshNetworkRoomInfo();
        this.startNetworkSync();
    }

    ngOnDestroy(): void {
        this.clearBotTimers();
        if (this.networkIntervalId !== null) {
            window.clearInterval(this.networkIntervalId);
            this.networkIntervalId = null;
        }
    }

    get hasMatch(): boolean {
        return this.state.match !== null && this.state.currentPlayer !== null;
    }

    get matchState(): MatchState | null {
        return this.state.match;
    }

    get roundState(): RoundState | null {
        return this.state.match?.currentRound ?? null;
    }

    get boardBranches(): BoardBranches {
        return this.state.boardBranches;
    }

    get moveHistory(): readonly MoveHistoryEntry[] {
        return this.state.moveHistory;
    }

    get currentPlayer(): PlayerId | null {
        return this.state.currentPlayer;
    }

    get score() {
        return this.state.match?.score ?? { AC: 0, BD: 0 };
    }

    get players(): readonly PlayerView[] {
        if (!this.state.match || !this.state.currentPlayer) {
            return [];
        }

        const botPlayers = TURN_ORDER.filter((playerId) => !this.isHumanPlayer(playerId));
        return TURN_ORDER.map((playerId) => {
            const isHuman = !SIMULATE_ALL_BOTS && this.isHumanPlayer(playerId);
            const botIndex = botPlayers.indexOf(playerId);
            return {
                id: playerId,
                name: this.getPlayerName(playerId, isHuman, botIndex),
                team: getPlayerTeam(playerId),
                handCount: this.state.match!.currentRound.hands[playerId].length,
                isHuman,
                isCurrent: !this.isRoundOver && playerId === this.state.currentPlayer,
            };
        });
    }

    get roundStarter(): PlayerId | null {
        return this.state.match?.currentRound.starter ?? null;
    }

    get nextPlayer(): PlayerId | null {
        if (!this.state.currentPlayer || this.isRoundOver) {
            return null;
        }

        return nextTurn(this.state.currentPlayer);
    }

    get humanHand(): readonly DominoTile[] {
        return this.state.match?.currentRound.hands[this.humanPlayer] ?? [];
    }

    get humanLegalMoves(): readonly LegalMove[] {
        return this.state.match && !this.isRoundOver
            ? getLegalMoves(this.state.match.currentRound, this.humanPlayer)
            : [];
    }

    get isHumanTurn(): boolean {
        return !SIMULATE_ALL_BOTS && this.state.currentPlayer === this.humanPlayer && this.hasMatch && !this.isMatchOver && !this.isRoundOver;
    }

    get isBotTurn(): boolean {
        return this.hasMatch && !this.isMatchOver && !this.isRoundOver && this.state.currentPlayer !== null && !this.isHumanTurn;
    }

    get botThinkingPlayer(): PlayerId | null {
        return this.isBotTurn && this.state.currentPlayer ? this.state.currentPlayer : null;
    }

    get isMatchOver(): boolean {
        return this.state.match ? isMatchOver(this.state.match) : false;
    }

    get isRoundOver(): boolean {
        return this.state.lastRoundResult !== null;
    }

    get canStartNextRound(): boolean {
        return this.state.pendingNextMatch !== null && !this.isMatchOver;
    }

    get lastRoundResult(): RoundResult | null {
        return this.state.lastRoundResult;
    }

    get roundEndSummary(): RoundEndSummary | null {
        return this.state.roundEndSummary;
    }

    get winnerTeam(): TeamId | null {
        return this.state.match ? getMatchWinner(this.state.match) : null;
    }

    get galoPopup(): GaloPopup | null {
        return this.state.galoPopup;
    }

    get recentEvent(): RecentTurnEvent | null {
        return this.state.recentEvent;
    }

    get recentReaction(): RecentReaction | null {
        return this.state.recentReaction;
    }

    get botCountdownLabel(): number | null {
        return this.isBotTurn ? (this.botActionCountdown ?? BOT_MOVE_DELAY_MS / 1000) : null;
    }

    get isNetworkGuest(): boolean {
        return this.networkConfig !== null && !this.networkConfig.isHost;
    }

    get networkRoomId(): string | null {
        return this.networkConfig?.roomId ?? null;
    }

    get isNetworkHost(): boolean {
        return this.networkConfig?.isHost ?? false;
    }

    get networkHumanPlayers(): readonly PlayerId[] {
        if (this.networkConfig === null) {
            return this.state.humanPlayers;
        }

        return mergePlayerIds(this.state.humanPlayers, this.networkConfig.humanPlayers);
    }

    get networkPlayerNames(): PlayerNames {
        return {
            ...(this.networkConfig?.playerNames ?? {}),
            ...this.state.playerNames,
        };
    }

    get humanPlayer(): PlayerId {
        return this.networkConfig?.role ?? HUMAN_PLAYER;
    }

    get humanPlayerName(): string {
        return this.getPlayerName(this.humanPlayer, true, -1);
    }

    playerLabel(playerId: PlayerId | null): string {
        if (playerId === null) {
            return "";
        }

        const player = this.players.find((item) => item.id === playerId);
        return player?.name ?? playerId;
    }

    setNetworkRoomInfo(humanPlayers: readonly PlayerId[], playerNames: PlayerNames = {}): void {
        if (this.networkConfig === null) {
            return;
        }

        const mergedHumanPlayers = mergePlayerIds(this.networkConfig.humanPlayers, this.state.humanPlayers, humanPlayers);
        const mergedPlayerNames = {
            ...this.state.playerNames,
            ...this.networkConfig.playerNames,
            ...playerNames,
        };
        this.networkConfig = {
            ...this.networkConfig,
            humanPlayers: mergedHumanPlayers,
            playerNames: mergedPlayerNames,
        };
        this.state = {
            ...this.state,
            humanPlayers: mergedHumanPlayers,
            playerNames: mergedPlayerNames,
        };
    }

    dismissGaloPopup(): void {
        this.state = {
            ...this.state,
            galoPopup: null,
        };
    }

    startNewMatch(): void {
        if (this.isNetworkGuest) {
            return;
        }

        this.botActionCountdown = null;
        this.playSound("shuffle");
        this.setState(createFreshLocalState(this.networkHumanPlayers, this.networkPlayerNames));
    }

    startNextRound(): void {
        if (this.isNetworkGuest) {
            return;
        }

        this.botActionCountdown = null;
        if (!isActiveState(this.state) || !this.state.pendingNextMatch) {
            return;
        }

        this.playSound("shuffle");
        this.setState({
            ...this.state,
            humanPlayers: this.networkHumanPlayers,
            playerNames: this.networkPlayerNames,
            match: this.state.pendingNextMatch,
            boardBranches: createEmptyBoardBranches(),
            currentPlayer: this.state.pendingNextMatch.currentRound.starter,
            pendingNextMatch: null,
            lastPlayedPlayer: null,
            passChain: null,
            lastPassPlayer: null,
            lastRoundResult: null,
            roundEndSummary: null,
            recentEvent: null,
            recentReaction: null,
            galoPopup: null,
        });
    }

    sendReaction(emoji: string): void {
        if (!this.hasMatch || !emoji.trim()) {
            return;
        }

        if (this.isNetworkGuest) {
            void this.postNetworkReaction(emoji, "none");
            return;
        }

        this.setState(this.withReaction(this.state, this.humanPlayer, emoji, "none"));
    }

    sendLaughReaction(): void {
        if (!this.hasMatch) {
            return;
        }

        if (this.isNetworkGuest) {
            void this.postNetworkReaction("😆", "laugh");
            return;
        }

        this.setState(this.withReaction(this.state, this.humanPlayer, "😆", "laugh"));
    }

    playHumanMove(move: LegalMove): void {
        if (!isActiveState(this.state)) {
            return;
        }

        if (isMatchOver(this.state.match) || this.state.lastRoundResult !== null || this.state.currentPlayer !== this.humanPlayer) {
            return;
        }

        const legalMoves = getLegalMoves(this.state.match.currentRound, this.humanPlayer);
        const isLegal = legalMoves.some((candidate) => sameMove(candidate, move));
        if (!isLegal) {
            return;
        }

        this.playMoveSound(move);
        if (this.isNetworkGuest) {
            void this.postNetworkCommand(move);
            return;
        }

        this.setState(this.advanceWithMove(this.state, move));
    }

    private setState(nextState: LocalMatchState): void {
        this.state = {
            ...nextState,
            humanPlayers: this.networkHumanPlayers,
            playerNames: this.networkPlayerNames,
        };
        if (this.networkConfig?.isHost) {
            void this.postNetworkSnapshot();
        }

        if (!this.isNetworkGuest) {
            this.scheduleBotMove();
        }
    }

    private clearBotTimers(): void {
        if (this.botTimeoutId !== null) {
            window.clearTimeout(this.botTimeoutId);
            this.botTimeoutId = null;
        }
        if (this.botIntervalId !== null) {
            window.clearInterval(this.botIntervalId);
            this.botIntervalId = null;
        }
    }

    private readNetworkConfig(): NetworkConfig | null {
        const params = new URLSearchParams(window.location.search);
        const roomId = params.get("room");
        const role = params.get("role");
        if (!roomId || !this.isPlayerId(role)) {
            return null;
        }

        const humanPlayers = this.parseHumanPlayers(params.get("humans"));
        const playerNames = this.parsePlayerNames(params.get("names"));
        const apiBase = params.get("api") ?? this.getDefaultApiBase();
        return {
            roomId,
            role,
            humanPlayers,
            playerNames,
            isHost: role === "A",
            apiBase,
        };
    }

    private getDefaultApiBase(): string {
        if (window.location.port === "4201" || window.location.port === "4200") {
            return `http://${window.location.hostname}:4310`;
        }

        return window.location.origin;
    }

    private isPlayerId(value: string | null): value is PlayerId {
        return value === "A" || value === "B" || value === "C" || value === "D";
    }

    private parseHumanPlayers(value: string | null): readonly PlayerId[] {
        if (value === null || value.trim() === "") {
            return ["A", "B", "C", "D"];
        }

        const players = value
            .split(",")
            .map((item) => item.trim().toUpperCase())
            .filter((item): item is PlayerId => this.isPlayerId(item));

        return players.length > 0 ? Array.from(new Set(players)) : ["A", "B", "C", "D"];
    }

    private parsePlayerNames(value: string | null): PlayerNames {
        if (value === null || value.trim() === "") {
            return {};
        }

        try {
            const parsed = JSON.parse(value) as Record<string, unknown>;
            return TURN_ORDER.reduce<PlayerNames>((names, playerId) => {
                const rawName = parsed[playerId];
                if (typeof rawName === "string" && rawName.trim()) {
                    const name = rawName.trim().slice(0, 24);
                    if (!isPlaceholderPlayerName(playerId, name)) {
                        names[playerId] = name;
                    }
                }

                return names;
            }, {});
        } catch {
            return {};
        }
    }

    private getPlayerName(playerId: PlayerId, isHuman: boolean, botIndex: number): string {
        const configuredName = this.networkPlayerNames[playerId]?.trim();
        if (configuredName && !isPlaceholderPlayerName(playerId, configuredName)) {
            return configuredName;
        }

        if (!isHuman) {
            return `CPU ${botIndex + 1}`;
        }

        return playerId === this.humanPlayer ? "Voce" : playerId;
    }

    private getHistoryPlayerLabel(playerId: PlayerId): string {
        const isHuman = this.isHumanPlayer(playerId);
        const botPlayers = TURN_ORDER.filter((candidate) => !this.isHumanPlayer(candidate));
        const botIndex = botPlayers.indexOf(playerId);
        return this.getPlayerName(playerId, isHuman, botIndex);
    }

    private isHumanPlayer(playerId: PlayerId): boolean {
        if (this.networkConfig !== null) {
            return this.networkHumanPlayers.includes(playerId);
        }

        return playerId === HUMAN_PLAYER;
    }

    private isBotPlayer(playerId: PlayerId): boolean {
        if (SIMULATE_ALL_BOTS) {
            return true;
        }

        if (this.networkConfig !== null) {
            return this.networkConfig.isHost && !this.networkHumanPlayers.includes(playerId);
        }

        return playerId !== HUMAN_PLAYER;
    }

    private startNetworkSync(): void {
        if (this.networkConfig === null) {
            return;
        }

        if (this.networkConfig.isHost) {
            this.networkIntervalId = window.setInterval(() => {
                void this.pollNetworkCommands();
            }, 700);
            return;
        }

        this.networkIntervalId = window.setInterval(() => {
            void this.pollNetworkSnapshot();
        }, 700);
        void this.pollNetworkSnapshot();
    }

    async refreshNetworkRoomInfo(): Promise<void> {
        if (this.networkConfig === null) {
            return;
        }

        try {
            const response = await fetch(`${this.networkConfig.apiBase}/rooms/${encodeURIComponent(this.networkConfig.roomId)}`);
            const payload = (await response.json()) as NetworkRoomPayload;
            if (!response.ok || !payload.room) {
                return;
            }

            this.setNetworkRoomInfo(
                payload.room.humanPlayers ?? this.networkConfig.humanPlayers,
                payload.room.playerNames ?? {},
            );
        } catch {
            // O jogo continua com os dados da URL caso a consulta da sala falhe.
        }
    }

    private async postNetworkSnapshot(): Promise<void> {
        if (!this.networkConfig?.isHost) {
            return;
        }

        await fetch(`${this.networkConfig.apiBase}/rooms/${this.networkConfig.roomId}/snapshot`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ snapshot: this.state }),
        });
    }

    private async pollNetworkSnapshot(): Promise<void> {
        if (!this.networkConfig || this.networkConfig.isHost) {
            return;
        }

        const response = await fetch(`${this.networkConfig.apiBase}/rooms/${this.networkConfig.roomId}/snapshot`);
        const payload = (await response.json()) as {
            readonly version: number;
            readonly snapshot: LocalMatchState | null;
            readonly room?: {
                readonly humanPlayers?: readonly PlayerId[];
                readonly playerNames?: PlayerNames;
            };
        };
        if (payload.room) {
            this.setNetworkRoomInfo(
                payload.room.humanPlayers ?? this.networkHumanPlayers,
                payload.room.playerNames ?? {},
            );
        }

        if (payload.snapshot === null || payload.version <= this.lastSnapshotVersion) {
            return;
        }

        this.lastSnapshotVersion = payload.version;
        this.clearBotTimers();
        const snapshot = payload.snapshot as LocalMatchState & Partial<Pick<LocalMatchState, "humanPlayers" | "playerNames">>;
        const humanPlayers = mergePlayerIds(this.networkHumanPlayers, payload.room?.humanPlayers ?? [], snapshot.humanPlayers ?? []);
        const playerNames = {
            ...(snapshot.playerNames ?? {}),
            ...this.networkPlayerNames,
            ...(payload.room?.playerNames ?? {}),
        };
        const nextState: LocalMatchState = {
            ...snapshot,
            humanPlayers,
            playerNames,
        };
        this.playGuestSnapshotSounds(this.state, nextState);
        this.setNetworkRoomInfo(humanPlayers, playerNames);
        this.state = nextState;
    }

    private async postNetworkCommand(move: LegalMove): Promise<void> {
        if (!this.networkConfig || this.networkConfig.isHost) {
            return;
        }

        await fetch(`${this.networkConfig.apiBase}/rooms/${this.networkConfig.roomId}/commands`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                playerId: this.humanPlayer,
                move,
            }),
        });
    }

    private async postNetworkReaction(emoji: string, sound: "none" | "laugh"): Promise<void> {
        if (!this.networkConfig || this.networkConfig.isHost) {
            return;
        }

        await fetch(`${this.networkConfig.apiBase}/rooms/${this.networkConfig.roomId}/commands`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                playerId: this.humanPlayer,
                action: "reaction",
                emoji,
                sound,
            }),
        });
    }

    private async pollNetworkCommands(): Promise<void> {
        if (!this.networkConfig?.isHost) {
            return;
        }

        await this.refreshNetworkRoomInfo();
        if (this.hasMatch) {
            void this.postNetworkSnapshot();
        }

        const response = await fetch(
            `${this.networkConfig.apiBase}/rooms/${this.networkConfig.roomId}/commands?after=${this.lastNetworkCommandId}`,
        );
        const payload = (await response.json()) as { readonly commands: readonly NetworkCommand[] };

        for (const command of payload.commands) {
            this.lastNetworkCommandId = Math.max(this.lastNetworkCommandId, command.id);
            this.applyNetworkCommand(command);
        }
    }

    private applyNetworkCommand(command: NetworkCommand): void {
        if (!isActiveState(this.state)) {
            return;
        }

        if (command.action === "reaction") {
            this.setState(this.withReaction(this.state, command.playerId, command.emoji, command.sound ?? "none"));
            return;
        }

        if (command.playerId === "A") {
            return;
        }

        if (isMatchOver(this.state.match) || this.state.lastRoundResult !== null || this.state.currentPlayer !== command.playerId) {
            return;
        }

        const legalMoves = getLegalMoves(this.state.match.currentRound, command.playerId);
        const isLegal = legalMoves.some((candidate) => sameMove(candidate, command.move));
        if (!isLegal) {
            return;
        }

        this.playMoveSound(command.move);
        this.setState(this.advanceWithMove(this.state, command.move));
    }

    private scheduleBotMove(): void {
        this.clearBotTimers();

        if (!this.state.match || !this.state.currentPlayer) {
            return;
        }

        if (this.isMatchOver || this.isHumanTurn || this.state.lastRoundResult !== null) {
            return;
        }

        if (!this.isBotPlayer(this.state.currentPlayer)) {
            return;
        }

        const endAt = Date.now() + BOT_MOVE_DELAY_MS;
        this.botActionCountdown = BOT_MOVE_DELAY_MS / 1000;

        this.botIntervalId = window.setInterval(() => {
            const remainingMs = Math.max(0, endAt - Date.now());
            this.botActionCountdown = Math.ceil(remainingMs / 1000);
        }, 250);

        this.botTimeoutId = window.setTimeout(() => {
            if (!isActiveState(this.state)) {
                return;
            }

            if (
                isMatchOver(this.state.match) ||
                this.state.lastRoundResult !== null ||
                !this.isBotPlayer(this.state.currentPlayer)
            ) {
                return;
            }

            const canScoreGalo =
                this.state.passChain?.afterPlayBy === this.state.currentPlayer && this.state.passChain.passers.length === 3;
            const move = chooseBotMove(this.state.match.currentRound, this.state.currentPlayer, {
                turnOrder: TURN_ORDER,
                bonusScoreOpportunity: canScoreGalo ? GALO_BONUS_POINTS : 0,
            });
            this.botActionCountdown = null;
            this.playMoveSound(move);
            this.setState(this.advanceWithMove(this.state, move));
        }, BOT_MOVE_DELAY_MS);
    }

    private playMoveSound(move: LegalMove): void {
        if (move.kind === "play") {
            this.playSound("tile");
        }
    }

    private advanceWithMove(state: ActiveLocalMatchState, move: LegalMove): ActiveLocalMatchState {
        const { match, currentPlayer } = state;
        const roundAfterMove = applyMoveToRound(match.currentRound, currentPlayer, move);
        const boardBranchesAfterMove =
            move.kind !== "play"
                ? state.boardBranches
                : move.phase === "opening"
                  ? createEmptyBoardBranches()
                  : {
                        ...state.boardBranches,
                        [move.endSide]: [...state.boardBranches[move.endSide], move.orientedPiece],
                    };
        const playedTileForHistory =
            move.kind !== "play" ? null : move.phase === "opening" ? move.piece : move.orientedPiece;

        let scoreAfterMove = match.score;
        let recentEvent: TurnEvent | null = null;
        let historyEntry: MoveHistoryEntry;
        let lastPlayedPlayerAfterMove = state.lastPlayedPlayer;
        let passChainAfterMove = state.passChain;
        let galoPopupAfterMove = state.galoPopup;
        let adjustedPreviousHistory = state.moveHistory;

        if (move.kind === "play") {
            const isGalo = state.passChain?.afterPlayBy === currentPlayer && state.passChain.passers.length === 3;
            const galoPoints = isGalo ? GALO_BONUS_POINTS : 0;
            if (isGalo && state.passChain !== null && state.passChain.firstPassPoints > 0) {
                scoreAfterMove = subtractPoints(
                    scoreAfterMove,
                    state.passChain.firstPassAwardedTeam,
                    state.passChain.firstPassPoints,
                );
            }
            const immediatePoints = getScoreForPlayedMove(roundAfterMove.board, roundAfterMove.starter);
            const totalPlayPoints = immediatePoints + galoPoints;
            const team = getTeamByPlayer(currentPlayer);
            if (isGalo) {
                adjustedPreviousHistory = this.trimTrailingPassEntriesForRound(
                    adjustedPreviousHistory,
                    match.currentRound.roundNumber,
                );
            }
            if (galoPoints > 0) {
                galoPopupAfterMove = {
                    id: adjustedPreviousHistory.length + 1,
                    playerId: currentPlayer,
                    team,
                    points: galoPoints,
                };
                this.playSound("galo");
            }
            scoreAfterMove = addPoints(scoreAfterMove, team, totalPlayPoints);
            if (totalPlayPoints > 0 && galoPoints === 0) {
                this.playSound("point");
            }
            recentEvent =
                totalPlayPoints > 0
                    ? { type: "score", playerId: currentPlayer, team, points: totalPlayPoints }
                    : { type: "play", playerId: currentPlayer };
            historyEntry = {
                id: adjustedPreviousHistory.length + 1,
                roundNumber: match.currentRound.roundNumber,
                playerId: currentPlayer,
                description: `${this.getHistoryPlayerLabel(currentPlayer)} jogou ${formatTileForHistory(playedTileForHistory ?? move.piece)}${galoPoints > 0 ? " (galo +50)" : ""}`,
                points: totalPlayPoints,
            };
            lastPlayedPlayerAfterMove = currentPlayer;
            passChainAfterMove = null;
        } else {
            const canTrackGalo = state.lastPlayedPlayer !== null;
            const isFirstPassAfterPlay =
                canTrackGalo &&
                (state.passChain === null ||
                    state.passChain.afterPlayBy !== state.lastPlayedPlayer ||
                    state.passChain.passers.length === 0);
            const penaltyPoints = isFirstPassAfterPlay ? getPassPenalty() : 0;
            const penaltyTeam = isFirstPassAfterPlay ? getPassPenaltyAwardedTeam(currentPlayer) : null;
            scoreAfterMove = addPoints(scoreAfterMove, penaltyTeam, penaltyPoints);
            if (penaltyPoints > 0) {
                this.playSound("point");
            }

            if (canTrackGalo) {
                const existingPassers =
                    state.passChain !== null && state.passChain.afterPlayBy === state.lastPlayedPlayer
                        ? state.passChain.passers
                        : [];
                const nextPassers = existingPassers.includes(currentPlayer)
                    ? existingPassers
                    : [...existingPassers, currentPlayer];
                const previousFirstPassTeam =
                    state.passChain !== null && state.passChain.afterPlayBy === state.lastPlayedPlayer
                        ? state.passChain.firstPassAwardedTeam
                        : penaltyTeam;
                const previousFirstPassPoints =
                    state.passChain !== null && state.passChain.afterPlayBy === state.lastPlayedPlayer
                        ? state.passChain.firstPassPoints
                        : penaltyPoints;

                passChainAfterMove = {
                    afterPlayBy: state.lastPlayedPlayer,
                    passers: nextPassers,
                    firstPassAwardedTeam: previousFirstPassTeam,
                    firstPassPoints: previousFirstPassPoints,
                };
            }

            recentEvent = {
                type: "pass",
                playerId: currentPlayer,
                awardedTeam: penaltyTeam,
                points: penaltyPoints,
            };
            historyEntry = {
                id: state.moveHistory.length + 1,
                roundNumber: match.currentRound.roundNumber,
                playerId: currentPlayer,
                description:
                    penaltyPoints > 0
                        ? `${this.getHistoryPlayerLabel(currentPlayer)} passou (+${penaltyPoints} para ${penaltyTeam})`
                        : `${this.getHistoryPlayerLabel(currentPlayer)} passou (sem pontuacao em passe consecutivo)`,
                points: penaltyPoints,
            };
        }

        const moveHistoryAfterMove = [...adjustedPreviousHistory, historyEntry];

        let matchAfterMove: MatchState = {
            ...match,
            score: scoreAfterMove,
            currentRound: roundAfterMove,
        };

        const roundResult = getRoundResult(roundAfterMove);
        if (roundResult !== null) {
            const hasCarrocaBatidaBonus =
                move.kind === "play" &&
                roundResult.reason === "batida" &&
                roundResult.winnerPlayer === currentPlayer &&
                isDouble(move.piece);
            const moveHistoryWithCarrocaBonus =
                hasCarrocaBatidaBonus && moveHistoryAfterMove.length > 0
                    ? [
                          ...moveHistoryAfterMove.slice(0, -1),
                          {
                              ...moveHistoryAfterMove[moveHistoryAfterMove.length - 1],
                              points: moveHistoryAfterMove[moveHistoryAfterMove.length - 1].points + CARROCA_BATIDA_BONUS_POINTS,
                              description: `${moveHistoryAfterMove[moveHistoryAfterMove.length - 1].description} (carroca batida +20)`,
                          },
                      ]
                    : moveHistoryAfterMove;
            const adjustedRoundResult: RoundResult = hasCarrocaBatidaBonus
                ? {
                      ...roundResult,
                      points: roundResult.points + CARROCA_BATIDA_BONUS_POINTS,
                  }
                : roundResult;
            const garagemPoints =
                adjustedRoundResult.reason === "batida" && adjustedRoundResult.winnerTeam !== null
                    ? roundDownToNearestFive(sumTeamHands(roundAfterMove, getOpponentTeam(adjustedRoundResult.winnerTeam)))
                    : 0;
            const moveHistoryAfterRoundEnd =
                adjustedRoundResult.winnerTeam !== null && garagemPoints > 0
                    ? [
                          ...moveHistoryWithCarrocaBonus,
                          {
                              id: moveHistoryWithCarrocaBonus.length + 1,
                              roundNumber: match.currentRound.roundNumber,
                              playerId: currentPlayer,
                              description: `${adjustedRoundResult.winnerTeam} recebeu de garagem:`,
                              points: garagemPoints,
                          },
                      ]
                    : moveHistoryWithCarrocaBonus;
            const matchAfterRoundEnd = applyRoundEnd(matchAfterMove, adjustedRoundResult);
            const finishedRoundMatch: MatchState = {
                ...matchAfterRoundEnd,
                currentRound: {
                    ...matchAfterRoundEnd.currentRound,
                    phase: "finished",
                },
            };
            const done = isMatchOver(matchAfterRoundEnd);
            const nextMatch = done
                ? null
                : createNextRound(matchAfterRoundEnd, {
                      startBySixSix: adjustedRoundResult.reason === "blocked",
                  });

            return {
                humanPlayers: state.humanPlayers,
                playerNames: state.playerNames,
                match: finishedRoundMatch,
                boardBranches: boardBranchesAfterMove,
                moveHistory: moveHistoryAfterRoundEnd,
                currentPlayer: nextMatch?.currentRound.starter ?? currentPlayer,
                pendingNextMatch: nextMatch,
                lastActedPlayer: currentPlayer,
                lastPlayedPlayer: lastPlayedPlayerAfterMove,
                passChain: passChainAfterMove,
                lastPassPlayer: move.kind === "pass" ? currentPlayer : null,
                lastRoundResult: adjustedRoundResult,
                roundEndSummary: getRoundEndSummary(roundAfterMove, adjustedRoundResult),
                recentEvent,
                recentReaction: state.recentReaction,
                galoPopup: galoPopupAfterMove,
            };
        }

        matchAfterMove = {
            ...matchAfterMove,
            currentRound: {
                ...matchAfterMove.currentRound,
                phase: "in_progress",
            },
        };

        return {
            humanPlayers: state.humanPlayers,
            playerNames: state.playerNames,
            match: matchAfterMove,
            boardBranches: boardBranchesAfterMove,
            moveHistory: moveHistoryAfterMove,
            currentPlayer: nextTurn(currentPlayer),
            pendingNextMatch: null,
            lastActedPlayer: currentPlayer,
            lastPlayedPlayer: lastPlayedPlayerAfterMove,
            passChain: passChainAfterMove,
            lastPassPlayer: move.kind === "pass" ? currentPlayer : null,
            lastRoundResult: null,
            roundEndSummary: null,
            recentEvent,
            recentReaction: state.recentReaction,
            galoPopup: galoPopupAfterMove,
        };
    }

    private withReaction(
        state: LocalMatchState,
        playerId: PlayerId,
        emoji: string,
        sound: "none" | "laugh",
    ): LocalMatchState {
        if (sound === "laugh") {
            this.playSound("laugh");
        }

        return {
            ...state,
            recentReaction: {
                id: Date.now(),
                playerId,
                emoji: emoji.slice(0, 8),
                sound,
            },
        };
    }

    private trimTrailingPassEntriesForRound(
        history: readonly MoveHistoryEntry[],
        roundNumber: number,
    ): readonly MoveHistoryEntry[] {
        let index = history.length - 1;
        while (index >= 0) {
            const item = history[index];
            if (item.roundNumber !== roundNumber || !item.description.includes(" passou")) {
                break;
            }

            index -= 1;
        }

        return history.slice(0, index + 1);
    }

    private playGuestSnapshotSounds(previousState: LocalMatchState, nextState: LocalMatchState): void {
        const previousRoundNumber = previousState.match?.currentRound.roundNumber ?? null;
        const nextRoundNumber = nextState.match?.currentRound.roundNumber ?? null;
        const didStartMatch = previousState.match === null && nextState.match !== null;
        const didAdvanceRound =
            previousRoundNumber !== null &&
            nextRoundNumber !== null &&
            nextRoundNumber > previousRoundNumber &&
            nextState.lastRoundResult === null;

        if (didStartMatch || didAdvanceRound) {
            this.playSound("shuffle");
        }

        const previousHistoryLength = previousState.moveHistory.length;
        const nextHistoryLength = nextState.moveHistory.length;
        const didReceiveNewHistoryEntry = nextHistoryLength > previousHistoryLength;
        const previousRecentEventKey = this.getRecentEventSoundKey(previousState.recentEvent);
        const nextRecentEventKey = this.getRecentEventSoundKey(nextState.recentEvent);

        if (didReceiveNewHistoryEntry && nextRecentEventKey !== null && nextRecentEventKey !== previousRecentEventKey) {
            if (nextState.recentEvent?.type === "play" || nextState.recentEvent?.type === "score") {
                this.playSound("tile");
            }

            if (
                (nextState.recentEvent?.type === "score" && nextState.recentEvent.points > 0) ||
                (nextState.recentEvent?.type === "pass" && nextState.recentEvent.points > 0)
            ) {
                this.playSound("point");
            }
        }

        const previousReactionKey = previousState.recentReaction
            ? `${previousState.recentReaction.id}-${previousState.recentReaction.sound}`
            : null;
        const nextReactionKey = nextState.recentReaction
            ? `${nextState.recentReaction.id}-${nextState.recentReaction.sound}`
            : null;
        if (
            nextReactionKey !== null &&
            nextReactionKey !== previousReactionKey &&
            nextState.recentReaction?.sound === "laugh"
        ) {
            this.playSound("laugh");
        }

        const previousGaloId = previousState.galoPopup?.id ?? null;
        const nextGaloId = nextState.galoPopup?.id ?? null;
        if (nextGaloId !== null && nextGaloId !== previousGaloId) {
            this.playSound("galo");
        }
    }

    private getRecentEventSoundKey(event: TurnEvent | null): string | null {
        if (event === null) {
            return null;
        }

        return `${event.type}-${event.playerId}-${"points" in event ? event.points : 0}`;
    }

    private playSound(kind: "tile" | "shuffle" | "point" | "galo" | "laugh"): void {
        if (typeof Audio === "undefined") {
            return;
        }

        const sourceByKind: Record<typeof kind, string> = {
            tile: "assets/sons/jogando_new.mp3",
            shuffle: "assets/sons/embaralhando.mp3.mp3",
            point: "assets/sons/ponto coin.mp3.mp3",
            galo: "assets/sons/galo.mp3.mp3",
            laugh: "assets/sons/risada-muttley-rabugento.mp3",
        };
        const audio = new Audio(sourceByKind[kind]);
        audio.volume = kind === "shuffle" ? 0.55 : kind === "laugh" ? 0.85 : 0.75;
        void audio.play().catch(() => {
            // Alguns navegadores bloqueiam audio antes da primeira interacao.
        });
    }
}
