import { Injectable, OnDestroy, isDevMode } from "@angular/core";
import { Capacitor } from "@capacitor/core";
import type { BoardSide, DominoTile, LegalMove, MatchState, PlayerId, RoundState, TeamId } from "../../../core/domino";
import { LocalMatchService } from "./local-match.service";
import { clearBackendSession, persistBackendSession, readBackendSessionKey } from "./backend-session-storage.util";
import { getDefaultBackendApiBase, resolveTrustedApiBase } from "./network-api-base.util";
import type {
    BoardBranches,
    GaloPopup,
    MoveHistoryEntry,
    NetworkRole,
    PlayerNames,
    PlayerView,
    RecentReaction,
    RecentTurnEvent,
    RoundEndSummary,
} from "./local-match.service";

type BackendNetworkConfig = {
    readonly roomCode: string;
    readonly role: NetworkRole;
    readonly sessionKey: string;
    readonly apiBase: string;
};

type BackendRoomStatus = {
    readonly code: string;
    readonly name: string;
    readonly status: string;
    readonly current_match_id: number | null;
    readonly available_roles: readonly PlayerId[];
    readonly occupied_roles: readonly PlayerId[];
    readonly player_names: Partial<Record<PlayerId, string>>;
};

type BackendHistoryEvent = {
    readonly event: string;
    readonly round_number?: number;
    readonly starter?: PlayerId;
    readonly player?: PlayerId;
    readonly winner_player?: PlayerId | null;
    readonly winner_team?: TeamId | null;
    readonly emoji?: string;
    readonly sound?: "none" | "laugh";
    readonly tile?: readonly [number, number];
    readonly phase?: "opening" | "end";
    readonly side?: BoardSide;
    readonly points?: number;
    readonly penalty_team?: TeamId | null;
    readonly penalty_points?: number;
    readonly galo_points?: number;
    readonly carroca_batida_bonus?: number;
};

type BackendMatchStatus = {
    readonly id: number;
    readonly status: "active" | "finished" | "pending" | "cancelled";
    readonly current_turn_order: number;
    readonly score: {
        readonly AC: number;
        readonly BD: number;
    };
    readonly history: readonly BackendHistoryEvent[];
    readonly round: {
        readonly round_number: number;
        readonly phase: "setup" | "in_progress" | "finished";
        readonly starter: PlayerId;
        readonly redeal_count: number;
        readonly board: {
            readonly opening_carroca: readonly [number, number] | null;
            readonly placed_tiles_count: number;
            readonly ends: Record<BoardSide, {
                readonly side: BoardSide;
                readonly open_value: number | null;
                readonly branch_length: number;
                readonly tip_is_double: boolean;
                readonly is_open: boolean;
            }>;
        };
        readonly board_branches: Record<BoardSide, readonly (readonly [number, number])[]>;
        readonly last_round_result: {
            readonly reason: "batida" | "blocked";
            readonly winner_team: TeamId | null;
            readonly winner_player: PlayerId | null;
            readonly points: number;
        } | null;
        readonly round_end_summary: {
            readonly round_number: number;
            readonly reason: "batida" | "blocked";
            readonly winner_team: TeamId | null;
            readonly winner_player: PlayerId | null;
            readonly points_awarded: number;
            readonly loser_team: TeamId | null;
            readonly loser_hands: readonly {
                readonly player: PlayerId;
                readonly tiles: readonly (readonly [number, number])[];
                readonly total: number;
            }[];
            readonly totals: {
                readonly AC: number;
                readonly BD: number;
            };
            readonly rounded_from: number;
            readonly rounded_to: number;
        } | null;
        readonly pending_next_round: number | null;
    };
    readonly participants: readonly {
        readonly role: PlayerId;
        readonly team: TeamId;
        readonly nickname_snapshot: string;
        readonly hand_count: number;
        readonly is_bot: boolean;
    }[];
};

type BackendPrivateMatchState = BackendMatchStatus & {
    readonly player: {
        readonly role: PlayerId;
        readonly team: TeamId;
        readonly hand_state: readonly (readonly [number, number])[];
        readonly legal_moves: readonly ({
            readonly kind: "pass";
            readonly reason: "no_legal_moves";
        } | {
            readonly kind: "play";
            readonly phase: "opening";
            readonly tile: readonly [number, number];
        } | {
            readonly kind: "play";
            readonly phase: "end";
            readonly side: BoardSide;
            readonly tile: readonly [number, number];
            readonly oriented_tile: readonly [number, number];
        })[];
    };
};

type RealtimePayload = {
    readonly type: "room_state";
    readonly room: BackendRoomStatus;
    readonly match: BackendMatchStatus | BackendPrivateMatchState | null;
};

type OnlineState = {
    readonly roomInfo: BackendRoomStatus | null;
    readonly matchStatus: BackendMatchStatus | null;
    readonly privateState: BackendPrivateMatchState | null;
    readonly moveHistory: readonly MoveHistoryEntry[];
    readonly recentEvent: RecentTurnEvent | null;
    readonly recentReaction: RecentReaction | null;
    readonly galoPopup: GaloPopup | null;
};

type OptimisticState = {
    readonly roundState: RoundState;
    readonly boardBranches: BoardBranches;
    readonly humanHand: readonly DominoTile[];
    readonly currentPlayer: PlayerId;
    readonly players: readonly PlayerView[];
};

function toTile(tile: readonly [number, number]): DominoTile {
    return { left: tile[0] as DominoTile["left"], right: tile[1] as DominoTile["right"] };
}

function emptyBranchState(): BoardBranches {
    return { north: [], east: [], south: [], west: [] };
}

function createPlaceholderHand(count: number): readonly DominoTile[] {
    return Array.from({ length: count }, () => ({ left: 0 as const, right: 0 as const }));
}

function formatTile(tile: readonly [number, number] | DominoTile): string {
    const left = "left" in tile ? tile.left : tile[0];
    const right = "right" in tile ? tile.right : tile[1];
    return `[${left}|${right}]`;
}


function sameTile(left: DominoTile, right: DominoTile): boolean {
    return left.left === right.left && left.right === right.right;
}

function removeTileFromHand(hand: readonly DominoTile[], tile: DominoTile): readonly DominoTile[] {
    let removed = false;
    return hand.filter((current) => {
        if (!removed && sameTile(current, tile)) {
            removed = true;
            return false;
        }

        return true;
    });
}

function nextTurn(playerId: PlayerId): PlayerId {
    const turnOrder = ["A", "B", "C", "D"] as const;
    const index = turnOrder.indexOf(playerId);
    return turnOrder[(index + 1) % turnOrder.length];
}

@Injectable({
    providedIn: "root",
})
export class MatchFacadeService implements OnDestroy {
    private readonly backendNetworkConfig = this.readBackendNetworkConfig();
    private networkIntervalId: number | null = null;
    private socket: WebSocket | null = null;
    private socketReconnectTimeoutId: number | null = null;
    private onlineState: OnlineState = {
        roomInfo: null,
        matchStatus: null,
        privateState: null,
        moveHistory: [],
        recentEvent: null,
        recentReaction: null,
        galoPopup: null,
    };
    private dismissedGaloEventKey = "";
    private lastHistoryEventKey = "";
    private moveRequestInFlight = false;
    private refreshRequestInFlight = false;
    private optimisticState: OptimisticState | null = null;

    constructor(private readonly local: LocalMatchService) {
        if (this.isBackendMode) {
            void this.refreshNetworkRoomInfo();
            this.startNetworkSync();
        }
    }

    ngOnDestroy(): void {
        if (this.networkIntervalId !== null) {
            window.clearInterval(this.networkIntervalId);
            this.networkIntervalId = null;
        }
        if (this.socketReconnectTimeoutId !== null) {
            window.clearTimeout(this.socketReconnectTimeoutId);
            this.socketReconnectTimeoutId = null;
        }
        this.socket?.close();
        this.socket = null;
    }

    get hasMatch(): boolean {
        return this.isBackendMode ? this.onlineState.matchStatus !== null : this.local.hasMatch;
    }

    get matchState(): MatchState | null {
        return this.isBackendMode ? this.buildMatchState() : this.local.matchState;
    }

    get roundState(): RoundState | null {
        if (!this.isBackendMode) {
            return this.local.roundState;
        }

        return this.optimisticState?.roundState ?? this.buildRoundState();
    }

    get boardBranches(): BoardBranches {
        if (!this.isBackendMode) {
            return this.local.boardBranches;
        }

        return this.optimisticState?.boardBranches ?? this.buildBoardBranches();
    }

    get moveHistory(): readonly MoveHistoryEntry[] {
        return this.isBackendMode ? this.onlineState.moveHistory : this.local.moveHistory;
    }

    get currentPlayer(): PlayerId | null {
        if (!this.isBackendMode) {
            return this.local.currentPlayer;
        }

        if (this.optimisticState) {
            return this.optimisticState.currentPlayer;
        }

        const currentTurnOrder = this.onlineState.matchStatus?.current_turn_order;
        if (!currentTurnOrder) {
            return null;
        }

        return (["A", "B", "C", "D"] as const)[currentTurnOrder - 1] ?? null;
    }

    get score() {
        return this.isBackendMode ? (this.onlineState.matchStatus?.score ?? { AC: 0, BD: 0 }) : this.local.score;
    }

    get players(): readonly PlayerView[] {
        if (!this.isBackendMode) {
            return this.local.players;
        }

        if (this.optimisticState) {
            return this.optimisticState.players;
        }

        const matchStatus = this.onlineState.matchStatus;
        if (!matchStatus) {
            return [];
        }

        return matchStatus.participants.map((participant) => ({
            id: participant.role,
            name: this.getBackendPlayerName(participant.role),
            team: participant.team,
            handCount: participant.hand_count,
            isHuman: !participant.is_bot,
            isCurrent: this.currentPlayer === participant.role && !this.isRoundOver,
        }));
    }

    get roundStarter(): PlayerId | null {
        return this.isBackendMode ? (this.onlineState.matchStatus?.round.starter ?? null) : this.local.roundStarter;
    }

    get nextPlayer(): PlayerId | null {
        if (!this.isBackendMode) {
            return this.local.nextPlayer;
        }

        const currentPlayer = this.currentPlayer;
        if (currentPlayer === null || this.isRoundOver || this.isMatchOver) {
            return null;
        }

        const turnOrder = ["A", "B", "C", "D"] as const;
        const index = turnOrder.indexOf(currentPlayer);
        return turnOrder[(index + 1) % turnOrder.length] ?? null;
    }

    get humanHand(): readonly DominoTile[] {
        if (!this.isBackendMode) {
            return this.local.humanHand;
        }

        return this.optimisticState?.humanHand ?? this.onlineState.privateState?.player.hand_state.map(toTile) ?? [];
    }

    get humanLegalMoves(): readonly LegalMove[] {
        if (!this.isBackendMode) {
            return this.local.humanLegalMoves;
        }

        return (this.onlineState.privateState?.player.legal_moves ?? []).map((move) => {
            if (move.kind === "pass") {
                return move;
            }

            if (move.phase === "opening") {
                return {
                    kind: "play",
                    phase: "opening",
                    piece: toTile(move.tile),
                } satisfies LegalMove;
            }

            return {
                kind: "play",
                phase: "end",
                endSide: move.side,
                piece: toTile(move.tile),
                orientedPiece: toTile(move.oriented_tile),
            } satisfies LegalMove;
        });
    }

    get isHumanTurn(): boolean {
        return this.isBackendMode
            ? this.currentPlayer === this.humanPlayer && !this.isMatchOver && !this.isRoundOver && !this.moveRequestInFlight
            : this.local.isHumanTurn;
    }

    get isMovePending(): boolean {
        return this.isBackendMode ? this.moveRequestInFlight : false;
    }

    get isBotTurn(): boolean {
        return this.isBackendMode ? false : this.local.isBotTurn;
    }

    get botThinkingPlayer(): PlayerId | null {
        return this.isBackendMode ? null : this.local.botThinkingPlayer;
    }

    get isMatchOver(): boolean {
        return this.isBackendMode ? this.onlineState.matchStatus?.status === "finished" : this.local.isMatchOver;
    }

    get isRoundOver(): boolean {
        return this.isBackendMode ? this.lastRoundResult !== null : this.local.isRoundOver;
    }

    get canStartNextRound(): boolean {
        return this.isBackendMode
            ? this.isNetworkHost && this.onlineState.matchStatus?.round.pending_next_round !== null
            : this.local.canStartNextRound;
    }

    get lastRoundResult() {
        if (!this.isBackendMode) {
            return this.local.lastRoundResult;
        }

        const result = this.onlineState.matchStatus?.round.last_round_result;
        if (!result) {
            return null;
        }

        return {
            reason: result.reason,
            winnerTeam: result.winner_team,
            winnerPlayer: result.winner_player,
            points: result.points,
        };
    }

    get roundEndSummary(): RoundEndSummary | null {
        if (!this.isBackendMode) {
            return this.local.roundEndSummary;
        }

        const summary = this.onlineState.matchStatus?.round.round_end_summary;
        if (!summary) {
            return null;
        }

        return {
            roundNumber: summary.round_number,
            reason: summary.reason,
            winnerTeam: summary.winner_team,
            winnerPlayer: summary.winner_player,
            pointsAwarded: summary.points_awarded,
            loserTeam: summary.loser_team,
            loserHands: summary.loser_hands.map((item) => ({
                playerId: item.player,
                tiles: item.tiles.map(toTile),
                total: item.total,
            })),
            totals: summary.totals,
            roundedFrom: summary.rounded_from,
            roundedTo: summary.rounded_to,
        };
    }

    get winnerTeam(): TeamId | null {
        if (!this.isBackendMode) {
            return this.local.winnerTeam;
        }

        if (!this.isMatchOver) {
            return null;
        }

        return this.score.AC > this.score.BD ? "AC" : "BD";
    }

    get galoPopup(): GaloPopup | null {
        return this.isBackendMode ? this.onlineState.galoPopup : this.local.galoPopup;
    }

    get recentEvent(): RecentTurnEvent | null {
        return this.isBackendMode ? this.onlineState.recentEvent : this.local.recentEvent;
    }

    get recentReaction(): RecentReaction | null {
        if (this.isBackendMode) {
            return this.onlineState.recentReaction;
        }

        return (this.local as LocalMatchService & { recentReaction?: RecentReaction | null }).recentReaction ?? null;
    }

    get isSpectator(): boolean {
        if (this.isBackendMode) {
            return this.backendNetworkConfig?.role === "spectator";
        }

        return (this.local as LocalMatchService & { isSpectator?: boolean }).isSpectator ?? false;
    }

    get abandonmentPlayer(): PlayerId | null {
        if (!this.isBackendMode) {
            return null;
        }

        const history = this.onlineState.matchStatus?.history;
        const latestEvent = history?.[history.length - 1];
        if (!latestEvent || latestEvent.event !== "match_abandoned" || !latestEvent.player) {
            return null;
        }

        return latestEvent.player;
    }

    get botCountdownLabel(): number | null {
        return this.isBackendMode ? null : this.local.botCountdownLabel;
    }

    get isNetworkGuest(): boolean {
        return this.isBackendMode ? !this.isNetworkHost : this.local.isNetworkGuest;
    }

    get networkRoomId(): string | null {
        return this.isBackendMode ? this.backendNetworkConfig?.roomCode ?? null : this.local.networkRoomId;
    }

    get isNetworkHost(): boolean {
        return this.isBackendMode ? this.backendNetworkConfig?.role === "A" : this.local.isNetworkHost;
    }

    get networkHumanPlayers(): readonly PlayerId[] {
        return this.isBackendMode
            ? (this.onlineState.roomInfo?.occupied_roles ?? [this.humanPlayer])
            : this.local.networkHumanPlayers;
    }

    get networkPlayerNames(): PlayerNames {
        if (!this.isBackendMode) {
            return this.local.networkPlayerNames;
        }

        return {
            ...(this.onlineState.roomInfo?.player_names ?? {}),
            ...(this.onlineState.matchStatus?.participants.reduce<PlayerNames>((names, participant) => {
                names[participant.role] = participant.nickname_snapshot;
                return names;
            }, {}) ?? {}),
        };
    }

    get humanPlayer(): PlayerId {
        return this.isBackendMode
            ? (this.backendNetworkConfig?.role === "spectator" ? "A" : (this.backendNetworkConfig?.role ?? "A"))
            : this.local.humanPlayer;
    }

    get humanPlayerName(): string {
        return this.isBackendMode ? (this.isSpectator ? "Espectador" : "Voce") : this.local.humanPlayerName;
    }

    playerLabel(playerId: PlayerId | null): string {
        if (playerId === null) {
            return "";
        }

        return this.isBackendMode ? this.getBackendPlayerName(playerId) : this.local.playerLabel(playerId);
    }

    setNetworkRoomInfo(humanPlayers: readonly PlayerId[], playerNames: PlayerNames = {}): void {
        if (!this.isBackendMode) {
            this.local.setNetworkRoomInfo(humanPlayers, playerNames);
            return;
        }

        if (this.onlineState.roomInfo === null) {
            return;
        }

        this.onlineState = {
            ...this.onlineState,
            roomInfo: {
                ...this.onlineState.roomInfo,
                occupied_roles: humanPlayers,
                player_names: {
                    ...this.onlineState.roomInfo.player_names,
                    ...playerNames,
                },
            },
        };
    }

    dismissGaloPopup(): void {
        if (!this.isBackendMode) {
            this.local.dismissGaloPopup();
            return;
        }

        this.dismissedGaloEventKey = this.lastHistoryEventKey;
        this.onlineState = {
            ...this.onlineState,
            galoPopup: null,
        };
    }

    async startNewMatch(): Promise<void> {
        if (!this.isBackendMode) {
            this.local.startNewMatch();
            return;
        }

        if (!this.isNetworkHost || !this.backendNetworkConfig) {
            return;
        }

        const response = await fetch(`${this.backendNetworkConfig.apiBase}/games/rooms/${encodeURIComponent(this.backendNetworkConfig.roomCode)}/start_match/`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ session_key: this.backendNetworkConfig.sessionKey }),
        });
        if (!response.ok) {
            if (!response.ok) {
            await this.refreshNetworkRoomInfo();
        }
        }
    }

    async startNextRound(): Promise<void> {
        if (!this.isBackendMode) {
            this.local.startNextRound();
            return;
        }

        const matchId = this.onlineState.matchStatus?.id;
        if (!this.backendNetworkConfig || matchId === null || matchId === undefined) {
            return;
        }

        const response = await fetch(`${this.backendNetworkConfig.apiBase}/games/matches/${matchId}/next_round/`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ session_key: this.backendNetworkConfig.sessionKey }),
        });
        await this.refreshNetworkRoomInfo();
    }

    async leaveCurrentGame(): Promise<void> {
        if (!this.isBackendMode || !this.backendNetworkConfig) {
            return;
        }

        try {
            if (!this.isSpectator) {
                await fetch(`${this.backendNetworkConfig.apiBase}/games/rooms/${encodeURIComponent(this.backendNetworkConfig.roomCode)}/leave/`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ session_key: this.backendNetworkConfig.sessionKey }),
                });
            }
        } finally {
            clearBackendSession();
            this.socket?.close();
            this.socket = null;
        }
    }

    sendReaction(emoji: string): void {
        if (this.isBackendMode) {
            void this.submitBackendReaction(emoji);
            return;
        }

        const localWithReaction = this.local as LocalMatchService & { sendReaction?: (emoji: string) => void };
        localWithReaction.sendReaction?.(emoji);
    }

    playHumanMove(move: LegalMove): void {
        if (!this.isBackendMode) {
            this.local.playHumanMove(move);
            return;
        }

        if (this.moveRequestInFlight || !this.isHumanTurn) {
            return;
        }

        this.optimisticState = this.buildOptimisticState(move);
        this.moveRequestInFlight = true;
        void this.submitBackendMove(move).finally(() => {
            this.moveRequestInFlight = false;
        });
    }

    async refreshNetworkRoomInfo(): Promise<void> {
        if (!this.isBackendMode || !this.backendNetworkConfig) {
            await this.local.refreshNetworkRoomInfo();
            return;
        }

        if (this.refreshRequestInFlight) {
            return;
        }

        this.refreshRequestInFlight = true;
        try {
            const roomResponse = await fetch(
                `${this.backendNetworkConfig.apiBase}/games/rooms/${encodeURIComponent(this.backendNetworkConfig.roomCode)}/status/`,
            );
            if (!roomResponse.ok) {
                return;
            }

            const roomInfo = (await roomResponse.json()) as BackendRoomStatus;
            if (roomInfo.current_match_id === null) {
                this.onlineState = {
                    ...this.onlineState,
                    roomInfo,
                    matchStatus: null,
                    privateState: null,
                    moveHistory: [],
                    recentEvent: null,
                    recentReaction: null,
                    galoPopup: null,
                };
                this.optimisticState = null;
                return;
            }

            const matchResponse = await fetch(`${this.backendNetworkConfig.apiBase}/games/matches/${roomInfo.current_match_id}/status/`);
            if (!matchResponse.ok) {
                this.onlineState = {
                    ...this.onlineState,
                    roomInfo,
                };
                return;
            }

            const matchStatus = (await matchResponse.json()) as BackendMatchStatus;
            let privateState: BackendPrivateMatchState | null = null;
            if (!this.isSpectator) {
                const privateResponse = await fetch(`${this.backendNetworkConfig.apiBase}/games/matches/${roomInfo.current_match_id}/my_state/`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ session_key: this.backendNetworkConfig.sessionKey }),
                });
                if (!privateResponse.ok) {
                    this.onlineState = {
                        ...this.onlineState,
                        roomInfo,
                    };
                    return;
                }
                privateState = (await privateResponse.json()) as BackendPrivateMatchState;
            }
            this.applyBackendState(roomInfo, matchStatus, privateState);
        } catch {
            // O polling tenta novamente silenciosamente.
        } finally {
            this.refreshRequestInFlight = false;
        }
    }

    private get isBackendMode(): boolean {
        return this.backendNetworkConfig !== null;
    }

    private readBackendNetworkConfig(): BackendNetworkConfig | null {
        const params = new URLSearchParams(window.location.search);
        const roomCode = params.get("room")?.trim() ?? "";
        const role = params.get("role");
        if (!roomCode || !this.isNetworkRole(role)) {
            return null;
        }

        const apiBase = resolveTrustedApiBase({
            queryValue: params.get("api"),
            fallbackApiBase: getDefaultBackendApiBase(),
        });
        const sessionKeyFromQuery = params.get("session")?.trim() ?? "";
        if (sessionKeyFromQuery) {
            persistBackendSession({
                roomCode,
                role,
                apiBase,
                sessionKey: sessionKeyFromQuery,
            });
            this.removeSessionFromUrl(params);
        }

        const sessionKey = sessionKeyFromQuery || readBackendSessionKey({
            roomCode,
            role,
            apiBase,
        });
        if (!sessionKey) {
            return null;
        }

        return {
            roomCode,
            role,
            sessionKey,
            apiBase,
        };
    }

    private isPlayerId(value: string | null): value is PlayerId {
        return value === "A" || value === "B" || value === "C" || value === "D";
    }

    private isNetworkRole(value: string | null): value is NetworkRole {
        return this.isPlayerId(value) || value === "spectator";
    }

    private startNetworkSync(): void {
        if (!this.isBackendMode) {
            return;
        }

        this.connectWebSocket();
        this.networkIntervalId = window.setInterval(() => {
            if (this.socket?.readyState !== WebSocket.OPEN) {
                this.logNetworkDebug("[domino-online] fallback polling acionado", {
                    roomCode: this.backendNetworkConfig?.roomCode,
                    socketState: this.socket?.readyState ?? "sem-socket",
                    at: new Date().toISOString(),
                });
                void this.refreshNetworkRoomInfo();
            }
        }, 15000);
    }

    private connectWebSocket(): void {
        if (!this.backendNetworkConfig) {
            return;
        }

        if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
            return;
        }

        const socket = new WebSocket(this.getWebSocketUrl());
        this.socket = socket;

        socket.onopen = () => {
            this.logNetworkDebug("[domino-online] websocket conectado", {
                roomCode: this.backendNetworkConfig?.roomCode,
                at: new Date().toISOString(),
            });
            if (this.socketReconnectTimeoutId !== null) {
                window.clearTimeout(this.socketReconnectTimeoutId);
                this.socketReconnectTimeoutId = null;
            }
            socket.send(JSON.stringify({
                type: "auth",
                session_key: this.backendNetworkConfig?.sessionKey,
            }));
        };

        socket.onmessage = (event) => {
            try {
                const payload = JSON.parse(event.data) as RealtimePayload;
                if (payload.type !== "room_state") {
                    return;
                }
                this.logNetworkDebug("[domino-online] evento realtime recebido", {
                    roomCode: this.backendNetworkConfig?.roomCode,
                    matchId: payload.match?.id ?? null,
                    at: new Date().toISOString(),
                });
                this.applyRealtimePayload(payload);
            } catch {
                this.logNetworkDebug("[domino-online] falha ao ler evento realtime, usando refresh", {
                    roomCode: this.backendNetworkConfig?.roomCode,
                    at: new Date().toISOString(),
                });
                void this.refreshNetworkRoomInfo();
            }
        };

        socket.onclose = (event) => {
            this.logNetworkDebug("[domino-online] websocket fechado", {
                roomCode: this.backendNetworkConfig?.roomCode,
                code: event.code,
                reason: event.reason,
                wasClean: event.wasClean,
                at: new Date().toISOString(),
            });
            if (this.socket === socket) {
                this.socket = null;
            }
            if (this.socketReconnectTimeoutId !== null) {
                window.clearTimeout(this.socketReconnectTimeoutId);
                this.socketReconnectTimeoutId = null;
            }
            if (event.code === 4401 || event.code === 4403) {
                clearBackendSession();
                return;
            }
            this.socketReconnectTimeoutId = window.setTimeout(() => {
                this.connectWebSocket();
            }, 1000);
        };

        socket.onerror = (event) => {
            this.logNetworkDebug("[domino-online] erro no websocket", {
                roomCode: this.backendNetworkConfig?.roomCode,
                eventType: event.type,
                at: new Date().toISOString(),
            });
            socket.close();
        };
    }

    private getWebSocketUrl(): string {
        const roomCode = encodeURIComponent(this.backendNetworkConfig!.roomCode);
        const apiBase = this.backendNetworkConfig!.apiBase;

        if (apiBase.startsWith("/")) {
            const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
            return `${protocol}//${window.location.host}/ws/rooms/${roomCode}/`;
        }

        try {
            const apiUrl = new URL(apiBase, window.location.origin);
            const protocol = apiUrl.protocol === "https:" ? "wss:" : "ws:";
            return `${protocol}//${apiUrl.host}/ws/rooms/${roomCode}/`;
        } catch {
            const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
            return `${protocol}//${window.location.host}/ws/rooms/${roomCode}/`;
        }
    }

    private removeSessionFromUrl(params: URLSearchParams): void {
        if (!params.has("session")) {
            return;
        }

        params.delete("session");
        const nextQuery = params.toString();
        const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}${window.location.hash}`;
        window.history.replaceState(window.history.state, "", nextUrl);
    }

    private logNetworkDebug(message: string, payload: Record<string, unknown>): void {
        if (!isDevMode()) {
            return;
        }

        console.log(message, payload);
    }

    private applyRealtimePayload(payload: RealtimePayload): void {
        if (payload.match === null) {
            this.optimisticState = null;
            this.onlineState = {
                ...this.onlineState,
                roomInfo: payload.room,
                matchStatus: null,
                privateState: null,
                moveHistory: [],
                recentEvent: null,
                recentReaction: null,
                galoPopup: null,
            };
            return;
        }

        if ("player" in payload.match) {
            this.applyBackendState(payload.room, payload.match, payload.match);
            return;
        }

        const nextRecentReaction = payload.match.history.length > 0 ? this.mapRecentReaction(payload.match.history[payload.match.history.length - 1], payload.match.history.length) : null;
        const nextState: OnlineState = {
            ...this.onlineState,
            roomInfo: payload.room,
            matchStatus: payload.match,
            privateState: this.onlineState.privateState,
            moveHistory: payload.match.history.map((event, index) => this.mapMoveHistoryEntry(event, index + 1)),
            recentEvent: payload.match.history.length > 0 ? this.mapRecentEvent(payload.match.history[payload.match.history.length - 1]) : null,
            recentReaction: nextRecentReaction,
        };
        this.playOnlineStateSounds(this.onlineState, nextState);
        this.optimisticState = null;
        this.onlineState = nextState;
    }

    private buildBoardBranches(): BoardBranches {
        const branches = this.onlineState.matchStatus?.round.board_branches;
        if (!branches) {
            return emptyBranchState();
        }

        return {
            north: branches.north.map(toTile),
            east: branches.east.map(toTile),
            south: branches.south.map(toTile),
            west: branches.west.map(toTile),
        };
    }

    private buildRoundState(): RoundState | null {
        const matchStatus = this.onlineState.matchStatus;
        const privateState = this.onlineState.privateState;
        if (!matchStatus) {
            return null;
        }

        const hands: RoundState["hands"] = {
            A: createPlaceholderHand(matchStatus.participants.find((item) => item.role === "A")?.hand_count ?? 0),
            B: createPlaceholderHand(matchStatus.participants.find((item) => item.role === "B")?.hand_count ?? 0),
            C: createPlaceholderHand(matchStatus.participants.find((item) => item.role === "C")?.hand_count ?? 0),
            D: createPlaceholderHand(matchStatus.participants.find((item) => item.role === "D")?.hand_count ?? 0),
        };
        if (privateState) {
            hands[privateState.player.role] = privateState.player.hand_state.map(toTile);
        }

        return {
            roundNumber: matchStatus.round.round_number,
            phase: matchStatus.round.phase,
            board: {
                openingCarroca: matchStatus.round.board.opening_carroca ? toTile(matchStatus.round.board.opening_carroca) : null,
                placedTilesCount: matchStatus.round.board.placed_tiles_count,
                ends: {
                    north: this.mapBoardEnd(matchStatus.round.board.ends.north),
                    east: this.mapBoardEnd(matchStatus.round.board.ends.east),
                    south: this.mapBoardEnd(matchStatus.round.board.ends.south),
                    west: this.mapBoardEnd(matchStatus.round.board.ends.west),
                },
            },
            hands,
            starter: matchStatus.round.starter,
            mustOpenWithCarroca: true,
            redealCount: matchStatus.round.redeal_count,
        };
    }

    private buildMatchState(): MatchState | null {
        const roundState = this.buildRoundState();
        if (!roundState) {
            return null;
        }

        return {
            targetScore: 200,
            score: this.score,
            currentRound: roundState,
        };
    }

    private buildOptimisticState(move: LegalMove): OptimisticState | null {
        const roundState = this.buildRoundState();
        const matchStatus = this.onlineState.matchStatus;
        if (!roundState || !matchStatus) {
            return null;
        }

        const humanHand =
            move.kind === "play"
                ? removeTileFromHand(this.humanHand, move.piece)
                : this.humanHand;
        const currentPlayer = nextTurn(this.humanPlayer);
        const boardBranches =
            move.kind !== "play"
                ? this.boardBranches
                : move.phase === "opening"
                  ? emptyBranchState()
                  : {
                        ...this.boardBranches,
                        [move.endSide]: [...this.boardBranches[move.endSide], move.orientedPiece],
                    };

        const nextRoundState: RoundState =
            move.kind !== "play"
                ? {
                      ...roundState,
                      phase: "in_progress",
                      hands: {
                          ...roundState.hands,
                          [this.humanPlayer]: humanHand,
                      },
                  }
                : move.phase === "opening"
                  ? {
                        ...roundState,
                        phase: "in_progress",
                        hands: {
                            ...roundState.hands,
                            [this.humanPlayer]: humanHand,
                        },
                        board: {
                            openingCarroca: move.piece,
                            placedTilesCount: 1,
                            ends: {
                                north: { side: "north", openValue: move.piece.left, branchLength: 0, tipIsDouble: true, isOpen: true },
                                east: { side: "east", openValue: move.piece.left, branchLength: 0, tipIsDouble: true, isOpen: true },
                                south: { side: "south", openValue: move.piece.left, branchLength: 0, tipIsDouble: true, isOpen: true },
                                west: { side: "west", openValue: move.piece.left, branchLength: 0, tipIsDouble: true, isOpen: true },
                            },
                        },
                    }
                  : {
                        ...roundState,
                        phase: "in_progress",
                        hands: {
                            ...roundState.hands,
                            [this.humanPlayer]: humanHand,
                        },
                        board: {
                            ...roundState.board,
                            placedTilesCount: roundState.board.placedTilesCount + 1,
                            ends: {
                                ...roundState.board.ends,
                                [move.endSide]: {
                                    ...roundState.board.ends[move.endSide],
                                    openValue: move.orientedPiece.right,
                                    branchLength: roundState.board.ends[move.endSide].branchLength + 1,
                                    tipIsDouble: move.orientedPiece.left === move.orientedPiece.right,
                                    isOpen: true,
                                },
                            },
                        },
                    };

        const players = matchStatus.participants.map((participant) => ({
            id: participant.role,
            name: this.getBackendPlayerName(participant.role),
            team: participant.team,
            handCount:
                participant.role === this.humanPlayer
                    ? humanHand.length
                    : participant.hand_count,
            isHuman: !participant.is_bot,
            isCurrent: participant.role === currentPlayer,
        }));

        return {
            roundState: nextRoundState,
            boardBranches,
            humanHand,
            currentPlayer,
            players,
        };
    }

    private mapBoardEnd(end: BackendMatchStatus["round"]["board"]["ends"][BoardSide]) {
        return {
            side: end.side,
            openValue: end.open_value as RoundState["board"]["ends"][BoardSide]["openValue"],
            branchLength: end.branch_length,
            tipIsDouble: end.tip_is_double,
            isOpen: end.is_open,
        };
    }

    private getBackendPlayerName(role: PlayerId): string {
        if (role === this.humanPlayer) {
            return "Voce";
        }

        const configuredName = this.networkPlayerNames[role]?.trim();
        if (configuredName) {
            return configuredName;
        }

        const participant = this.onlineState.matchStatus?.participants.find((item) => item.role === role);
        if (participant?.is_bot) {
            return `CPU ${role}`;
        }

        return role;
    }

    private async submitBackendMove(move: LegalMove): Promise<void> {
        if (!this.backendNetworkConfig || !this.onlineState.matchStatus || this.isSpectator) {
            return;
        }

        const matchId = this.onlineState.matchStatus.id;
        const endpoint = move.kind === "pass" ? "pass_turn" : "play";
        const payload =
            move.kind === "pass"
                ? { session_key: this.backendNetworkConfig.sessionKey }
                : {
                      session_key: this.backendNetworkConfig.sessionKey,
                      tile: [move.piece.left, move.piece.right],
                      side: move.phase === "end" ? move.endSide : "right",
                  };

        const response = await fetch(`${this.backendNetworkConfig.apiBase}/games/matches/${matchId}/${endpoint === "pass_turn" ? "pass/" : "play/"}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });

        await this.refreshNetworkRoomInfo();

        if (!response.ok) {
            await this.refreshNetworkRoomInfo();
        }
    }

    private async submitBackendReaction(emoji: string): Promise<void> {
        if (!this.backendNetworkConfig || !this.onlineState.matchStatus || !emoji.trim()) {
            return;
        }

        const sound = emoji === "🤣" || emoji === "😆" ? "laugh" : "none";
        await fetch(`${this.backendNetworkConfig.apiBase}/games/matches/${this.onlineState.matchStatus.id}/react/`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                session_key: this.backendNetworkConfig.sessionKey,
                emoji,
                sound,
            }),
        });
    }

    private applyBackendState(
        roomInfo: BackendRoomStatus,
        matchStatus: BackendMatchStatus,
        privateState: BackendPrivateMatchState | null,
    ): void {
        const moveHistory = matchStatus.history.map((event, index) => this.mapMoveHistoryEntry(event, index + 1));
        const latestEvent = matchStatus.history[matchStatus.history.length - 1] ?? null;
        const latestEventKey = latestEvent ? `${matchStatus.id}-${matchStatus.history.length}-${latestEvent.event}-${latestEvent.round_number ?? 0}` : "";
        const recentEvent = latestEvent ? this.mapRecentEvent(latestEvent) : null;
        const recentReaction = latestEvent ? this.mapRecentReaction(latestEvent, matchStatus.history.length) : null;
        const galoPopup =
            latestEvent && latestEvent.event === "tile_played" && (latestEvent.galo_points ?? 0) > 0 && latestEventKey !== this.dismissedGaloEventKey
                ? {
                      id: matchStatus.history.length,
                      playerId: latestEvent.player ?? this.humanPlayer,
                      team: (latestEvent.player === "A" || latestEvent.player === "C" ? "AC" : "BD") as TeamId,
                      points: latestEvent.galo_points ?? 0,
                  }
                : this.onlineState.galoPopup;

        this.lastHistoryEventKey = latestEventKey;
        const nextState: OnlineState = {
            roomInfo,
            matchStatus,
            privateState,
            moveHistory,
            recentEvent,
            recentReaction,
            galoPopup,
        };
        this.playOnlineStateSounds(this.onlineState, nextState);
        this.optimisticState = null;
        this.onlineState = nextState;
    }

    private mapMoveHistoryEntry(event: BackendHistoryEvent, id: number): MoveHistoryEntry {
        if (event.event === "tile_played" && event.player && event.tile) {
            const galoSuffix = (event.galo_points ?? 0) > 0 ? ` (galo +${event.galo_points})` : "";
            const carrocaSuffix = (event.carroca_batida_bonus ?? 0) > 0 ? ` (carroca batida +${event.carroca_batida_bonus})` : "";
            return {
                id,
                roundNumber: event.round_number ?? 0,
                playerId: event.player,
                description: `${event.player} jogou ${formatTile(event.tile)}${galoSuffix}${carrocaSuffix}`,
                points: event.points ?? 0,
            };
        }

        if (event.event === "turn_passed" && event.player) {
            const points = event.penalty_points ?? 0;
            return {
                id,
                roundNumber: event.round_number ?? 0,
                playerId: event.player,
                description:
                    points > 0
                        ? `${event.player} passou (+${points} para ${event.penalty_team})`
                        : `${event.player} passou (sem pontuacao em passe consecutivo)`,
                points,
            };
        }

        if (event.event === "round_started" && event.starter) {
            return {
                id,
                roundNumber: event.round_number ?? 0,
                playerId: event.starter,
                description: `${event.starter} iniciou a rodada`,
                points: 0,
            };
        }

        if (event.event === "round_finished") {
            return {
                id,
                roundNumber: event.round_number ?? 0,
                playerId: this.humanPlayer,
                description: "Rodada encerrada",
                points: 0,
            };
        }

        if (event.event === "match_abandoned" && event.player) {
            return {
                id,
                roundNumber: event.round_number ?? 0,
                playerId: event.player,
                description: `${this.getBackendPlayerName(event.player)} abandonou a partida`,
                points: 0,
            };
        }

        return {
            id,
            roundNumber: event.round_number ?? 0,
            playerId: event.player ?? this.humanPlayer,
            description: "Partida iniciada",
            points: 0,
        };
    }

    private mapRecentReaction(event: BackendHistoryEvent, id: number): RecentReaction | null {
        if (event.event !== "reaction_sent" || !event.player || !event.emoji) {
            return null;
        }

        return {
            id,
            playerId: event.player,
            emoji: event.emoji,
            sound: event.sound ?? "none",
        };
    }

    private mapRecentEvent(event: BackendHistoryEvent): RecentTurnEvent | null {
        if (event.event === "turn_passed" && event.player) {
            return {
                type: "pass",
                playerId: event.player,
                awardedTeam: event.penalty_team ?? null,
                points: event.penalty_points ?? 0,
            };
        }

        if (event.event === "tile_played" && event.player) {
            const points = event.points ?? 0;
            if (points > 0) {
                return {
                    type: "score",
                    playerId: event.player,
                    team: event.player === "A" || event.player === "C" ? "AC" : "BD",
                    points,
                };
            }

            return {
                type: "play",
                playerId: event.player,
            };
        }

        return null;
    }

    private playOnlineStateSounds(previousState: OnlineState, nextState: OnlineState): void {
        const previousRoundNumber = previousState.matchStatus?.round.round_number ?? null;
        const nextRoundNumber = nextState.matchStatus?.round.round_number ?? null;
        const didStartMatch = previousState.matchStatus === null && nextState.matchStatus !== null;
        const didAdvanceRound =
            previousRoundNumber !== null &&
            nextRoundNumber !== null &&
            nextRoundNumber > previousRoundNumber &&
            nextState.matchStatus?.round.last_round_result === null;

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

    private getRecentEventSoundKey(event: RecentTurnEvent | null): string | null {
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
            laugh: "assets/sons/zoeira-risada-do-bandido.mp3",
        };
        const audio = new Audio(sourceByKind[kind]);
        audio.volume = kind === "shuffle" ? 0.55 : kind === "laugh" ? 0.85 : 0.75;
        void audio.play().catch(() => {
            // Alguns navegadores bloqueiam audio antes da primeira interacao.
        });
    }
}
