import { Component, DoCheck, OnDestroy } from "@angular/core";
import { tileKey } from "../../../../core/domino";
import type { BoardSide, DominoTile, LegalMove, PlayerId } from "../../../../core/domino";
import { LocalMatchService, PlayerNames } from "../../services/local-match.service";

function isPlayableMove(move: LegalMove): move is Extract<LegalMove, { kind: "play" }> {
    return move.kind === "play";
}

function isPassMove(move: LegalMove): move is Extract<LegalMove, { kind: "pass" }> {
    return move.kind === "pass";
}

type RoomInfo = {
    readonly roomId: string;
    readonly humanPlayers: readonly PlayerId[];
    readonly playerNames?: PlayerNames;
    readonly occupiedRoles: readonly PlayerId[];
    readonly availableRoles: readonly PlayerId[];
};

@Component({
    selector: "app-local-match-screen",
    templateUrl: "./local-match-screen.component.html",
    styleUrl: "./local-match-screen.component.scss",
})
export class LocalMatchScreenComponent implements DoCheck, OnDestroy {
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
    selectedJoinRole: PlayerId = "B";
    roomInfo: RoomInfo | null = null;
    roomStatusMessage = "";
    roomErrorMessage = "";
    isRoomRequestPending = false;
    turnSecondsLeft = 15;
    hasDismissedMatchModal = false;
    isHistoryOpen = false;

    private timerId: number | null = null;
    private lobbyPollId: number | null = null;
    private previousTurnKey = "";
    private previousActiveMatch = false;
    private hasQueuedMobileDisplayGesture = false;

    constructor(public match: LocalMatchService) {
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

        return (this.roomInfo?.humanPlayers.length ?? this.match.networkHumanPlayers.length) >= 2;
    }

    get occupiedLobbyRoles(): readonly PlayerId[] {
        return this.roomInfo?.occupiedRoles ?? this.match.networkHumanPlayers;
    }

    get availableJoinRoles(): readonly PlayerId[] {
        return this.roomInfo?.availableRoles?.length ? this.roomInfo.availableRoles : ["B", "C", "D"];
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
            const response = await fetch(`${this.getNetworkApiBase()}/rooms`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    roomId,
                    password: this.createRoomPassword,
                    playerName: this.createPlayerName,
                }),
            });
            const payload = (await response.json()) as {
                readonly error?: string;
                readonly role?: PlayerId;
                readonly humanPlayers?: readonly PlayerId[];
                readonly playerNames?: PlayerNames;
                readonly roomId?: string;
            };

            if (!response.ok || !payload.role || !payload.roomId) {
                this.setRoomMessage("", payload.error ?? "Nao foi possivel criar a sala.");
                return;
            }

            this.openNetworkRoom(payload.roomId, payload.role, payload.humanPlayers ?? ["A"], {
                ...(payload.playerNames ?? {}),
                [payload.role]: this.createPlayerName.trim(),
            });
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
            const response = await fetch(`${this.getNetworkApiBase()}/rooms/${encodeURIComponent(roomId)}/join`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    password: this.joinRoomPassword,
                    role: this.selectedJoinRole,
                    playerName: this.joinPlayerName,
                }),
            });
            const payload = (await response.json()) as {
                readonly error?: string;
                readonly role?: PlayerId;
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
                [payload.role]: this.joinPlayerName.trim(),
            });
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
            const response = await fetch(`${this.getNetworkApiBase()}/rooms/${encodeURIComponent(roomId)}`);
            const payload = (await response.json()) as {
                readonly exists?: boolean;
                readonly room?: RoomInfo | null;
                readonly error?: string;
            };

            if (!response.ok || !payload.exists || !payload.room) {
                this.roomInfo = null;
                this.setRoomMessage("", payload.error ?? "Sala nao encontrada.");
                return;
            }

            this.roomInfo = payload.room;
            this.selectedJoinRole = this.availableJoinRoles[0] ?? "B";
            this.setRoomMessage("Escolha sua posicao e informe a senha.", "");
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
        if (window.location.port === "4201" || window.location.port === "4200") {
            return `http://${window.location.hostname}:4310`;
        }

        return window.location.origin;
    }

    private getRoomServerUnavailableMessage(): string {
        if (window.location.port === "4201" || window.location.port === "4200") {
            return "Servidor de salas indisponivel. Rode npm run dev para subir o jogo e o servidor de salas juntos.";
        }

        return "Servidor de salas indisponivel.";
    }

    private openNetworkRoom(
        roomId: string,
        role: PlayerId,
        humanPlayers: readonly PlayerId[],
        playerNames: PlayerNames,
    ): void {
        const params = new URLSearchParams({
            room: roomId,
            role,
            humans: humanPlayers.join(","),
            names: JSON.stringify(playerNames),
        });
        const apiBase = this.getNetworkApiBase();
        if (apiBase !== window.location.origin) {
            params.set("api", apiBase);
        }

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
            const response = await fetch(`${this.getNetworkApiBase()}/rooms/${encodeURIComponent(roomId)}`);
            const payload = (await response.json()) as {
                readonly room?: RoomInfo | null;
            };
            if (!response.ok || !payload.room) {
                return;
            }

            this.roomInfo = payload.room;
            this.match.setNetworkRoomInfo(payload.room.humanPlayers, payload.room.playerNames ?? {});
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

    private lockLandscapeOrientation(): void {
        const orientation = screen.orientation as ScreenOrientation & {
            lock?: (orientation: "landscape") => Promise<void>;
        };
        void orientation.lock?.("landscape").catch(() => undefined);
    }
}
