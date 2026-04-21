import { AfterViewChecked, Component, DoCheck, ElementRef, OnDestroy, ViewChild } from "@angular/core";
import { tileKey } from "../../../../core/domino";
import type { BoardSide, DominoTile, LegalMove, PlayerId } from "../../../../core/domino";
<<<<<<< HEAD
import { LocalMatchService } from "../../services/local-match.service";
import type { MoveHistoryEntry, NetworkRole, PlayerNames, RecentReaction, RecentTurnEvent } from "../../services/local-match.service";
=======
import { MatchFacadeService } from "../../services/match-facade.service";
import type { MoveHistoryEntry, PlayerNames, RecentTurnEvent } from "../../services/local-match.service";
>>>>>>> 791dc5d (wip)

function isPlayableMove(move: LegalMove): move is Extract<LegalMove, { kind: "play" }> {
    return move.kind === "play";
}

function isPassMove(move: LegalMove): move is Extract<LegalMove, { kind: "pass" }> {
    return move.kind === "pass";
}

type RoomInfo = {
    readonly roomId: string;
    readonly playerNames?: PlayerNames;
    readonly occupiedRoles: readonly PlayerId[];
    readonly availableRoles: readonly PlayerId[];
    readonly spectators?: readonly string[];
};

type FloatingEvent = {
    readonly id: number;
    readonly playerId: PlayerId;
    readonly label: string;
    readonly kind: "score" | "pass" | "reaction";
};

@Component({
    selector: "app-local-match-screen",
    templateUrl: "./local-match-screen.component.html",
    styleUrl: "./local-match-screen.component.scss",
})
export class LocalMatchScreenComponent implements DoCheck, AfterViewChecked, OnDestroy {
    readonly reactionOptions = ["😀", "😂", "😮", "👏"];

    @ViewChild("mobileBottomRow") private mobileBottomRow?: ElementRef<HTMLElement>;

    selectedTileKey: string | null = null;
    selectedEnd: BoardSide | null = null;
    draggingTileKey: string | null = null;
    startPanel: "menu" | "create" | "join" = "menu";
    createRoomName = "";
    createRoomPassword = "";
    createPlayerName = "";
    joinRoomName = "";
    joinRoomPassword = "";
    joinPlayerName = "";
    selectedJoinRole: NetworkRole = "B";
    roomInfo: RoomInfo | null = null;
    roomStatusMessage = "";
    roomErrorMessage = "";
    isRoomRequestPending = false;
    turnSecondsLeft = 15;
    hasDismissedMatchModal = false;
    isHistoryOpen = false;
    floatingEvents: readonly FloatingEvent[] = [];
    mobileBottomRowHeight: number | null = null;

    private timerId: number | null = null;
    private lobbyPollId: number | null = null;
    private floatingEventTimeouts: number[] = [];
    private lastRecentEventKey = "";
    private lastReactionKey = "";
    private previousTurnKey = "";
    private previousActiveMatch = false;
    private isMobileBottomRowMeasureQueued = false;
    private hasQueuedMobileDisplayGesture = false;
    private isIosViewportSyncEnabled = false;
    private readonly onViewportResize = () => this.updateIosViewportHeight();

    constructor(public match: MatchFacadeService) {
        this.startLobbyPolling();
    }

    ngDoCheck(): void {
        const hasActiveMatch = this.match.hasMatch && this.match.roundState !== null && this.match.currentPlayer !== null;
        if (hasActiveMatch && !this.previousActiveMatch) {
            this.requestMobileFullscreen();
        }
        if (!hasActiveMatch) {
            this.hasQueuedMobileDisplayGesture = false;
        }
        this.previousActiveMatch = hasActiveMatch;
        this.queueFloatingEvent();
        this.queueReactionEvent();

        const turnKey = `${this.match.currentPlayer ?? "-"}-${this.match.roundState?.roundNumber ?? 0}-${this.match.isHumanTurn}`;
        if (turnKey === this.previousTurnKey) {
            return;
        }

        this.previousTurnKey = turnKey;
        this.resetHumanTimer();
    }

    ngOnDestroy(): void {
        this.clearHumanTimer();
        this.clearLobbyPolling();
        this.clearFloatingEventTimeouts();
        this.disableIosViewportSync();
    }

    ngAfterViewChecked(): void {
        this.freezeMobileBottomRowHeight();
    }

    get recentMoveHistory(): readonly MoveHistoryEntry[] {
        return this.match.moveHistory.slice(-3);
    }

    get acTeamLabel(): string {
        return this.getTeamLabel("AC");
    }

    get bdTeamLabel(): string {
        return this.getTeamLabel("BD");
    }

    get playableMoves(): readonly Extract<LegalMove, { kind: "play" }>[] {
        return this.match.humanLegalMoves.filter(isPlayableMove);
    }

    get humanPassMove(): Extract<LegalMove, { kind: "pass" }> | null {
        return this.match.humanLegalMoves.find(isPassMove) ?? null;
    }

    get canHumanPass(): boolean {
        return this.match.isHumanTurn && this.humanPassMove !== null;
    }

    get playableTileKeys(): ReadonlySet<string> {
        return new Set(this.playableMoves.map((move) => tileKey(move.piece)));
    }

    get selectedTileMoves(): readonly Extract<LegalMove, { kind: "play" }>[] {
        if (!this.selectedTileKey) {
            return [];
        }

        return this.playableMoves.filter((move) => tileKey(move.piece) === this.selectedTileKey);
    }

    get selectableEnds(): readonly BoardSide[] {
        return this.selectedTileMoves
            .filter((move): move is Extract<LegalMove, { kind: "play"; phase: "end" }> => move.phase === "end")
            .map((move) => move.endSide);
    }

    get moveOptionBySide(): Partial<Record<BoardSide, number>> {
        const options: Partial<Record<BoardSide, number>> = {};
        let count = 1;

        for (const move of this.selectedTileMoves) {
            if (move.phase !== "end" || options[move.endSide] !== undefined) {
                continue;
            }

            options[move.endSide] = count;
            count += 1;
        }

        return options;
    }

    get canOpenWithSelectedTile(): boolean {
        return this.selectedTileMoves.some((move) => move.phase === "opening");
    }

    get openingOrientation(): "horizontal" | "vertical" {
        return "vertical";
    }

    get selectionHint(): string {
        if (!this.match.hasMatch) {
            return "Clique em 'Nova partida' para iniciar.";
        }

        if (this.match.isMatchOver) {
            return "Partida encerrada. Voce pode visualizar a mesa final e o historico.";
        }

        if (this.match.isRoundOver) {
            return "Rodada encerrada. Confira os calculos e inicie a proxima rodada.";
        }

        if (!this.match.isHumanTurn) {
            return "";
        }

        if (!this.selectedTileKey) {
            return "Escolha uma peca para jogar.";
        }

        if (this.match.roundState?.board.openingCarroca === null && this.canOpenWithSelectedTile) {
            return "Passo 2: clique em 'Abrir mesa' para iniciar a rodada.";
        }

        if (this.selectableEnds.length > 0) {
            return "Passo 2: selecione uma ponta destacada em verde.";
        }

        return "Peca selecionada sem encaixe disponivel.";
    }

    get isCurrentHumanPlayer(): boolean {
        return this.match.currentPlayer === this.match.humanPlayer;
    }

    get isNextHumanPlayer(): boolean {
        return this.match.nextPlayer === this.match.humanPlayer;
    }

    get didHumanStartRound(): boolean {
        return this.match.roundState?.starter === this.match.humanPlayer;
    }

    get canStartNetworkRoomMatch(): boolean {
        if (!this.match.networkRoomId) {
            return true;
        }

        return (this.roomInfo?.occupiedRoles.length ?? this.match.networkHumanPlayers.length) >= 1;
    }

    get occupiedLobbyRoles(): readonly PlayerId[] {
        return this.roomInfo?.occupiedRoles ?? this.match.networkHumanPlayers;
    }

    get availableJoinRoles(): readonly PlayerId[] {
        return this.roomInfo?.availableRoles?.length ? this.roomInfo.availableRoles : ["B", "C", "D"];
    }

    get roomSpectators(): readonly string[] {
        return this.roomInfo?.spectators ?? [];
    }

    get lobbyPlayers(): readonly PlayerId[] {
        return ["A", "B", "C", "D"];
    }

    get shouldShowJoinRoomInfo(): boolean {
        return this.roomInfo !== null && this.match.networkRoomId === null;
    }

    playerOrCurrent(player: PlayerId | null): PlayerId {
        return player ?? this.match.currentPlayer ?? "A";
    }

    playerLabel(player: PlayerId | null): string {
        return this.match.playerLabel(player ?? this.match.currentPlayer ?? "A");
    }

    playerPositionClass(player: PlayerId): string {
        return (
            {
                A: "south",
                B: "west",
                C: "north",
                D: "east",
            } satisfies Record<PlayerId, string>
        )[player];
    }

    formatTilesForSummary(tiles: readonly DominoTile[]): string {
        if (tiles.length === 0) {
            return "sem pecas";
        }

        return tiles.map((tile) => `[${tile.left}|${tile.right}]`).join(" ");
    }

    openMoveHistory(): void {
        this.isHistoryOpen = true;
    }

    handleSelectTile(tile: DominoTile): void {
        const key = tileKey(tile);
        const shouldDeselect = this.selectedTileKey === key;
        this.selectedTileKey = shouldDeselect ? null : key;
        this.selectedEnd = null;

        if (shouldDeselect || !this.match.isHumanTurn || !this.selectedTileKey) {
            return;
        }

        const tileMoves = this.playableMoves.filter((move) => tileKey(move.piece) === this.selectedTileKey);
        if (tileMoves.length !== 1) {
            return;
        }

        this.match.playHumanMove(tileMoves[0]);
        this.clearSelection();
    }

    handleSelectEnd(side: BoardSide): void {
        this.selectedEnd = side;

        if (!this.selectedTileKey) {
            return;
        }

        const move = this.selectedTileMoves.find((candidate) => candidate.phase === "end" && candidate.endSide === side);
        if (!move) {
            return;
        }

        this.match.playHumanMove(move);
        this.clearSelection();
    }

    handlePlayOpening(): void {
        const openingMove = this.selectedTileMoves.find((candidate) => candidate.phase === "opening");
        if (!openingMove) {
            return;
        }

        this.match.playHumanMove(openingMove);
        this.clearSelection();
    }

    handleDragTileStart(tileKeyValue: string): void {
        if (!this.match.isHumanTurn) {
            return;
        }

        this.selectedTileKey = tileKeyValue;
        this.selectedEnd = null;
        this.draggingTileKey = tileKeyValue;
    }

    handleDragTileEnd(): void {
        this.draggingTileKey = null;
    }

    handleDropOnBoardSides(sides: readonly BoardSide[]): void {
        if (!this.match.isHumanTurn) {
            return;
        }

        const move = this.findDropEndMove(sides);
        if (!move) {
            return;
        }

        this.match.playHumanMove(move);
        this.clearSelection();
    }

    handleDropOnOpening(): void {
        if (!this.match.isHumanTurn) {
            return;
        }

        const move = this.findDropOpeningMove();
        if (!move) {
            return;
        }

        this.match.playHumanMove(move);
        this.clearSelection();
    }

    handlePassTurn(): void {
        if (!this.humanPassMove) {
            return;
        }

        this.match.playHumanMove(this.humanPassMove);
        this.clearSelection();
    }

    handleSendReaction(emoji: string): void {
        this.match.sendReaction(emoji);
    }

    handleSendLaughReaction(): void {
        this.match.sendLaughReaction();
    }

    async handleStartNewMatch(): Promise<void> {
        if (this.match.networkRoomId && !this.canStartNetworkRoomMatch) {
            this.setRoomMessage("", "Aguarde seu amigo entrar na sala antes de iniciar.");
            return;
        }

        if (this.match.networkRoomId && this.match.isNetworkHost) {
            await this.match.refreshNetworkRoomInfo();
            await this.pollRoomInfo();
        }

        if (this.match.networkRoomId && !this.canStartNetworkRoomMatch) {
            this.setRoomMessage("", "Aguarde seu amigo entrar na sala antes de iniciar.");
            return;
        }

        this.hasDismissedMatchModal = false;
        this.clearSelection();
        this.match.startNewMatch();
    }

    async handleCreateRoom(): Promise<void> {
        const roomId = this.normalizeRoomName(this.createRoomName);
        if (!roomId || !this.createRoomPassword.trim() || !this.createPlayerName.trim()) {
            this.setRoomMessage("", "Informe seu nome, o nome da sala e a senha.");
            return;
        }

        this.isRoomRequestPending = true;
        this.setRoomMessage("Criando sala...", "");

        try {
            const sessionResponse = await fetch(`${this.getNetworkApiBase()}/players/sessions/guest_session/`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ nickname: this.createPlayerName.trim() }),
            });
            const sessionPayload = (await sessionResponse.json()) as { readonly session_key?: string };
            if (!sessionResponse.ok || !sessionPayload.session_key) {
                this.setRoomMessage("", "Nao foi possivel criar sua sessao casual.");
                return;
            }

            const response = await fetch(`${this.getNetworkApiBase()}/games/rooms/`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    session_key: sessionPayload.session_key,
                    name: roomId,
                    password: this.createRoomPassword,
                    max_players: 4,
                    role: "A",
                }),
            });
            const payload = (await response.json()) as {
                readonly detail?: string;
                readonly code?: string;
            };

            if (!response.ok || !payload.code) {
                this.setRoomMessage("", payload.detail ?? "Nao foi possivel criar a sala.");
                return;
            }

            this.openNetworkRoom(payload.code, "A", sessionPayload.session_key);
        } catch {
            this.setRoomMessage("", this.getRoomServerUnavailableMessage());
        } finally {
            this.isRoomRequestPending = false;
        }
    }

    async handleJoinRoom(): Promise<void> {
        const roomId = this.normalizeRoomName(this.joinRoomName);
        if (!roomId || !this.joinRoomPassword.trim() || !this.joinPlayerName.trim()) {
            this.setRoomMessage("", "Informe seu nome, o nome da sala e a senha.");
            return;
        }

        this.isRoomRequestPending = true;
        this.setRoomMessage("Entrando na sala...", "");

        try {
            const sessionResponse = await fetch(`${this.getNetworkApiBase()}/players/sessions/guest_session/`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
<<<<<<< HEAD
                body: JSON.stringify({
                    password: this.joinRoomPassword,
                    role: this.selectedJoinRole,
                    spectator: this.selectedJoinRole === "spectator",
                    playerName: this.joinPlayerName,
                }),
            });
            const payload = (await response.json()) as {
                readonly error?: string;
                readonly role?: NetworkRole;
                readonly humanPlayers?: readonly PlayerId[];
                readonly playerNames?: PlayerNames;
                readonly roomId?: string;
            };

            if (!response.ok || !payload.role || !payload.roomId) {
                this.setRoomMessage("", payload.error ?? "Nao foi possivel entrar na sala.");
                return;
            }

            this.openNetworkRoom(payload.roomId, payload.role, payload.humanPlayers ?? ["A", "B"], {
                ...(payload.playerNames ?? {}),
                ...(payload.role !== "spectator" ? { [payload.role]: this.joinPlayerName.trim() } : {}),
=======
                body: JSON.stringify({ nickname: this.joinPlayerName.trim() }),
            });
            const sessionPayload = (await sessionResponse.json()) as { readonly session_key?: string };
            if (!sessionResponse.ok || !sessionPayload.session_key) {
                this.setRoomMessage("", "Nao foi possivel criar sua sessao casual.");
                return;
            }

            const response = await fetch(`${this.getNetworkApiBase()}/games/rooms/${encodeURIComponent(roomId)}/join/`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    session_key: sessionPayload.session_key,
                    password: this.joinRoomPassword,
                    role: this.selectedJoinRole,
                }),
>>>>>>> 791dc5d (wip)
            });
            const payload = (await response.json()) as {
                readonly detail?: string;
            };

            if (!response.ok) {
                this.setRoomMessage("", payload.detail ?? "Nao foi possivel entrar na sala.");
                return;
            }

            this.openNetworkRoom(roomId, this.selectedJoinRole, sessionPayload.session_key);
        } catch {
            this.setRoomMessage("", this.getRoomServerUnavailableMessage());
        } finally {
            this.isRoomRequestPending = false;
        }
    }

    async handleLookupJoinRoom(): Promise<void> {
        const roomId = this.normalizeRoomName(this.joinRoomName);
        if (!roomId) {
            this.setRoomMessage("", "Informe o nome da sala.");
            return;
        }

        this.isRoomRequestPending = true;
        this.setRoomMessage("Buscando sala...", "");

        try {
            const response = await fetch(`${this.getNetworkApiBase()}/games/rooms/${encodeURIComponent(roomId)}/status/`);
            const payload = (await response.json()) as {
                readonly code?: string;
                readonly player_names?: PlayerNames;
                readonly occupied_roles?: readonly PlayerId[];
                readonly available_roles?: readonly PlayerId[];
            };

            if (!response.ok || !payload.code) {
                this.roomInfo = null;
                this.setRoomMessage("", "Sala nao encontrada.");
                return;
            }

<<<<<<< HEAD
            this.roomInfo = payload.room;
            this.selectedJoinRole = this.availableJoinRoles[0] ?? "spectator";
            this.setRoomMessage("Escolha sua posicao ou entre como espectador.", "");
=======
            this.roomInfo = {
                roomId: payload.code,
                playerNames: payload.player_names,
                occupiedRoles: payload.occupied_roles ?? [],
                availableRoles: payload.available_roles ?? ["B", "C", "D"],
            };
            this.selectedJoinRole = this.availableJoinRoles[0] ?? "B";
            this.setRoomMessage("Escolha sua posicao e informe a senha.", "");
>>>>>>> 791dc5d (wip)
        } catch {
            this.setRoomMessage("", this.getRoomServerUnavailableMessage());
        } finally {
            this.isRoomRequestPending = false;
        }
    }

    private clearSelection(): void {
        this.selectedTileKey = null;
        this.selectedEnd = null;
        this.draggingTileKey = null;
    }

    private setRoomMessage(status: string, error: string): void {
        this.roomStatusMessage = status;
        this.roomErrorMessage = error;
    }

    private normalizeRoomName(value: string): string {
        return value
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9_-]+/g, "-")
            .replace(/^-+|-+$/g, "")
            .slice(0, 40);
    }

    private getNetworkApiBase(): string {
        return "/api";
    }

    private getRoomServerUnavailableMessage(): string {
        if (window.location.port === "4201" || window.location.port === "4200") {
            return "Backend indisponivel. Inicie o Angular com proxy e o Django em paralelo.";
        }

        return "Backend indisponivel.";
    }

<<<<<<< HEAD
    private openNetworkRoom(
        roomId: string,
        role: NetworkRole,
        humanPlayers: readonly PlayerId[],
        playerNames: PlayerNames,
    ): void {
=======
    private openNetworkRoom(roomId: string, role: PlayerId, sessionKey: string): void {
>>>>>>> 791dc5d (wip)
        const params = new URLSearchParams({
            room: roomId,
            role,
            session: sessionKey,
        });
        window.location.href = `${window.location.pathname}?${params.toString()}`;
    }

    private startLobbyPolling(): void {
        if (!this.match.networkRoomId || !this.match.isNetworkHost || this.match.hasMatch) {
            return;
        }

        void this.pollRoomInfo();
        this.lobbyPollId = window.setInterval(() => {
            void this.pollRoomInfo();
        }, 1000);
    }

    private clearLobbyPolling(): void {
        if (this.lobbyPollId === null) {
            return;
        }

        window.clearInterval(this.lobbyPollId);
        this.lobbyPollId = null;
    }

    private async pollRoomInfo(): Promise<void> {
        const roomId = this.match.networkRoomId;
        if (!roomId || this.match.hasMatch) {
            this.clearLobbyPolling();
            return;
        }

        try {
            const response = await fetch(`${this.getNetworkApiBase()}/games/rooms/${encodeURIComponent(roomId)}/status/`);
            const payload = (await response.json()) as {
                readonly code?: string;
                readonly player_names?: PlayerNames;
                readonly occupied_roles?: readonly PlayerId[];
                readonly available_roles?: readonly PlayerId[];
            };
            if (!response.ok || !payload.code) {
                return;
            }

            this.roomInfo = {
                roomId: payload.code,
                playerNames: payload.player_names,
                occupiedRoles: payload.occupied_roles ?? [],
                availableRoles: payload.available_roles ?? ["B", "C", "D"],
            };
            this.match.setNetworkRoomInfo(payload.occupied_roles ?? [], payload.player_names ?? {});
        } catch {
            // Mantem a tela usavel; a mensagem de erro aparece nas acoes de criar/entrar.
        }
    }

    private findDropEndMove(sides: readonly BoardSide[]): Extract<LegalMove, { kind: "play"; phase: "end" }> | null {
        const selectedKey = this.draggingTileKey ?? this.selectedTileKey;
        if (!selectedKey) {
            return null;
        }

        const endMoves = this.playableMoves.filter(
            (move): move is Extract<LegalMove, { kind: "play"; phase: "end" }> =>
                tileKey(move.piece) === selectedKey && move.phase === "end" && sides.includes(move.endSide),
        );

        if (endMoves.length === 0) {
            return null;
        }

        const exactSelected = this.selectedEnd ? endMoves.find((move) => move.endSide === this.selectedEnd) : null;
        return exactSelected ?? endMoves[0];
    }

    private findDropOpeningMove(): Extract<LegalMove, { kind: "play"; phase: "opening" }> | null {
        const selectedKey = this.draggingTileKey ?? this.selectedTileKey;
        if (!selectedKey) {
            return null;
        }

        return (
            this.playableMoves.find(
                (move): move is Extract<LegalMove, { kind: "play"; phase: "opening" }> =>
                    tileKey(move.piece) === selectedKey && move.phase === "opening",
            ) ?? null
        );
    }

    private resetHumanTimer(): void {
        this.clearHumanTimer();
        this.turnSecondsLeft = 15;

        if (!this.match.hasMatch || !this.match.isHumanTurn) {
            return;
        }

        this.timerId = window.setInterval(() => {
            this.turnSecondsLeft = Math.max(0, this.turnSecondsLeft - 1);
        }, 1000);
    }

    private clearHumanTimer(): void {
        if (this.timerId === null) {
            return;
        }

        window.clearInterval(this.timerId);
        this.timerId = null;
    }

    private requestMobileFullscreen(): void {
        if (typeof window === "undefined" || typeof document === "undefined") {
            return;
        }

        if (!this.isMobileDisplayViewport()) {
            return;
        }

        if (this.isIosWebKitBrowser()) {
            this.enableIosViewportSync();
            this.lockLandscapeOrientation();
            return;
        }

        const request = document.documentElement.requestFullscreen?.bind(document.documentElement);
        if (!request || document.fullscreenElement !== null) {
            this.lockLandscapeOrientation();
            return;
        }

        request()
            .then(() => this.lockLandscapeOrientation())
            .catch(() => {
            if (this.hasQueuedMobileDisplayGesture) {
                return;
            }

            this.hasQueuedMobileDisplayGesture = true;
            window.addEventListener(
                "pointerdown",
                () => {
                    this.hasQueuedMobileDisplayGesture = false;
                    if (document.fullscreenElement === null) {
                        void request().then(() => this.lockLandscapeOrientation());
                    } else {
                        this.lockLandscapeOrientation();
                    }
                },
                { once: true },
            );
        });
    }

    private isMobileDisplayViewport(): boolean {
        return window.matchMedia("(max-width: 900px), (max-height: 520px)").matches;
    }

    private isIosWebKitBrowser(): boolean {
        const userAgent = window.navigator.userAgent;
        const isAppleMobile = /iPhone|iPad|iPod/i.test(userAgent);
        const isTouchMac = /Macintosh/i.test(userAgent) && "ontouchend" in document;
        return isAppleMobile || isTouchMac;
    }

    private enableIosViewportSync(): void {
        if (this.isIosViewportSyncEnabled) {
            this.updateIosViewportHeight();
            return;
        }

        this.isIosViewportSyncEnabled = true;
        this.updateIosViewportHeight();
        window.addEventListener("resize", this.onViewportResize, { passive: true });
        window.addEventListener("orientationchange", this.onViewportResize, { passive: true });
        window.visualViewport?.addEventListener("resize", this.onViewportResize, { passive: true });
    }

    private disableIosViewportSync(): void {
        if (!this.isIosViewportSyncEnabled) {
            return;
        }

        this.isIosViewportSyncEnabled = false;
        window.removeEventListener("resize", this.onViewportResize);
        window.removeEventListener("orientationchange", this.onViewportResize);
        window.visualViewport?.removeEventListener("resize", this.onViewportResize);
        document.documentElement.style.removeProperty("--app-vh");
    }

    private updateIosViewportHeight(): void {
        this.mobileBottomRowHeight = null;
        this.isMobileBottomRowMeasureQueued = false;
        const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
        document.documentElement.style.setProperty("--app-vh", `${Math.floor(viewportHeight)}px`);
        window.scrollTo(0, 1);
    }

    private lockLandscapeOrientation(): void {
        const orientation = screen.orientation as ScreenOrientation & {
            lock?: (orientation: "landscape") => Promise<void>;
        };
        void orientation.lock?.("landscape").catch(() => undefined);
    }

    private queueFloatingEvent(): void {
        const event = this.match.recentEvent;
        if (!event) {
            return;
        }

        const key = this.recentEventKey(event);
        if (key === this.lastRecentEventKey) {
            return;
        }

        this.lastRecentEventKey = key;
        if (event.type === "play") {
            return;
        }

        const floatingEvent: FloatingEvent = {
            id: Date.now(),
            playerId: event.playerId,
            kind: event.type === "pass" ? "pass" : "score",
            label: event.type === "pass" ? (event.points > 0 ? `Passou +${event.points}` : "Passou") : `+${event.points}`,
        };
        this.floatingEvents = [...this.floatingEvents, floatingEvent].slice(-4);
        const timeoutId = window.setTimeout(() => {
            this.floatingEvents = this.floatingEvents.filter((item) => item.id !== floatingEvent.id);
        }, 1300);
        this.floatingEventTimeouts = [...this.floatingEventTimeouts, timeoutId];
    }

    private queueReactionEvent(): void {
        const reaction = this.match.recentReaction;
        if (!reaction) {
            return;
        }

        const key = this.recentReactionKey(reaction);
        if (key === this.lastReactionKey) {
            return;
        }

        this.lastReactionKey = key;
        const floatingEvent: FloatingEvent = {
            id: reaction.id,
            playerId: reaction.playerId,
            kind: "reaction",
            label: reaction.emoji,
        };
        this.floatingEvents = [...this.floatingEvents, floatingEvent].slice(-5);
        const timeoutId = window.setTimeout(() => {
            this.floatingEvents = this.floatingEvents.filter((item) => item.id !== floatingEvent.id);
        }, 1400);
        this.floatingEventTimeouts = [...this.floatingEventTimeouts, timeoutId];
    }

    private recentEventKey(event: RecentTurnEvent): string {
        return `${this.match.moveHistory.length}-${event.type}-${event.playerId}-${"points" in event ? event.points : 0}`;
    }

    private recentReactionKey(reaction: RecentReaction): string {
        return `${reaction.id}-${reaction.playerId}-${reaction.emoji}`;
    }

    private clearFloatingEventTimeouts(): void {
        for (const timeoutId of this.floatingEventTimeouts) {
            window.clearTimeout(timeoutId);
        }
        this.floatingEventTimeouts = [];
    }

    private getTeamLabel(teamId: "AC" | "BD"): string {
        const members = this.match.players.filter((player) => player.team === teamId).map((player) => player.name);
        return members.length > 0 ? members.join(" / ") : teamId;
    }

    private freezeMobileBottomRowHeight(): void {
        if (this.mobileBottomRowHeight !== null || this.isMobileBottomRowMeasureQueued || !this.mobileBottomRow) {
            return;
        }

        this.isMobileBottomRowMeasureQueued = true;
        queueMicrotask(() => {
            this.isMobileBottomRowMeasureQueued = false;
            if (this.mobileBottomRowHeight !== null || !this.mobileBottomRow) {
                return;
            }

            const height = Math.ceil(this.mobileBottomRow.nativeElement.getBoundingClientRect().height);
            if (height <= 0) {
                return;
            }

            this.mobileBottomRowHeight = height;
        });
    }
}
