const BACKEND_SESSION_STORAGE_KEY = "domino.backendSession";

type StoredBackendSession = {
    readonly roomCode: string;
    readonly role: string;
    readonly apiBase: string;
    readonly sessionKey: string;
};

type StoredBackendSessionMatch = {
    readonly roomCode: string;
    readonly role: string;
    readonly apiBase: string;
};

export function persistBackendSession(session: StoredBackendSession): void {
    window.sessionStorage.setItem(BACKEND_SESSION_STORAGE_KEY, JSON.stringify(session));
}

export function readBackendSessionKey(match: StoredBackendSessionMatch): string | null {
    const session = readStoredBackendSession();
    if (session === null) {
        return null;
    }

    if (session.roomCode !== match.roomCode || session.role !== match.role || session.apiBase !== match.apiBase) {
        return null;
    }

    return session.sessionKey;
}

export function clearBackendSession(): void {
    window.sessionStorage.removeItem(BACKEND_SESSION_STORAGE_KEY);
}

function readStoredBackendSession(): StoredBackendSession | null {
    const raw = window.sessionStorage.getItem(BACKEND_SESSION_STORAGE_KEY);
    if (!raw) {
        return null;
    }

    try {
        const parsed = JSON.parse(raw) as Partial<StoredBackendSession>;
        if (
            typeof parsed.roomCode !== "string" ||
            typeof parsed.role !== "string" ||
            typeof parsed.apiBase !== "string" ||
            typeof parsed.sessionKey !== "string"
        ) {
            clearBackendSession();
            return null;
        }

        return parsed as StoredBackendSession;
    } catch {
        clearBackendSession();
        return null;
    }
}
