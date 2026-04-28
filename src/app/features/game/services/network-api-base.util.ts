export const NETWORK_API_BASE_STORAGE_KEY = "domino.apiBase";

const DEFAULT_BACKEND_API_BASE = "https://domino-backend-kq4p.onrender.com/api";
const LOCAL_DEV_PORTS = ["8000", "4310"] as const;
const STATIC_LOCAL_DEV_HOSTS = ["localhost", "127.0.0.1", "10.0.2.2"] as const;

type ResolveTrustedApiBaseOptions = {
    readonly queryValue?: string | null;
    readonly fallbackApiBase: string;
    readonly useStoredValue?: boolean;
    readonly persistTrustedQuery?: boolean;
};

type PersistTrustedApiBaseOptions = {
    readonly fallbackApiBase: string;
};

export function normalizeApiBase(value: string | null | undefined): string {
    return (value ?? "").trim().replace(/\/+$/, "");
}

export function getDefaultBackendApiBase(): string {
    return DEFAULT_BACKEND_API_BASE;
}

export function getDefaultLegacyApiBase(): string {
    if (window.location.port === "4201" || window.location.port === "4200") {
        return `http://${window.location.hostname}:4310`;
    }

    return window.location.origin;
}

export function resolveTrustedApiBase(options: ResolveTrustedApiBaseOptions): string {
    const allowedOrigins = buildAllowedOrigins();
    const trustedFallback = getTrustedApiBase(options.fallbackApiBase, allowedOrigins) ?? normalizeApiBase(options.fallbackApiBase);
    const trustedQuery = getTrustedApiBase(options.queryValue, allowedOrigins);

    if (trustedQuery) {
        if (options.persistTrustedQuery) {
            window.localStorage.setItem(NETWORK_API_BASE_STORAGE_KEY, trustedQuery);
        }

        return trustedQuery;
    }

    if (options.useStoredValue ?? true) {
        const storedValue = window.localStorage.getItem(NETWORK_API_BASE_STORAGE_KEY);
        const trustedStored = getTrustedApiBase(storedValue, allowedOrigins);
        if (trustedStored) {
            return trustedStored;
        }

        if (storedValue) {
            window.localStorage.removeItem(NETWORK_API_BASE_STORAGE_KEY);
        }
    }

    return trustedFallback;
}

export function getTrustedApiBaseOrFallback(value: string | null | undefined, fallbackApiBase: string): string {
    const allowedOrigins = buildAllowedOrigins();
    return getTrustedApiBase(value, allowedOrigins) ?? resolveTrustedApiBase({ fallbackApiBase, useStoredValue: false });
}

export function persistTrustedApiBase(value: string | null | undefined, options: PersistTrustedApiBaseOptions): string {
    const trustedApiBase = getTrustedApiBaseOrFallback(value, options.fallbackApiBase);
    window.localStorage.setItem(NETWORK_API_BASE_STORAGE_KEY, trustedApiBase);
    return trustedApiBase;
}

function getTrustedApiBase(value: string | null | undefined, allowedOrigins: ReadonlySet<string>): string | null {
    const normalized = normalizeApiBase(value);
    if (!normalized) {
        return null;
    }

    if (normalized.startsWith("//")) {
        return null;
    }

    if (normalized.startsWith("/")) {
        return normalized;
    }

    if (!/^https?:\/\//i.test(normalized)) {
        return null;
    }

    try {
        const url = new URL(normalized);
        if (!allowedOrigins.has(url.origin)) {
            return null;
        }

        return normalizeApiBase(`${url.origin}${url.pathname}`);
    } catch {
        return null;
    }
}

function buildAllowedOrigins(): ReadonlySet<string> {
    const allowedOrigins = new Set<string>();

    allowedOrigins.add(window.location.origin);
    allowedOrigins.add(new URL(DEFAULT_BACKEND_API_BASE).origin);

    for (const host of getDynamicLocalDevHosts()) {
        for (const port of LOCAL_DEV_PORTS) {
            allowedOrigins.add(`http://${host}:${port}`);
        }
    }

    return allowedOrigins;
}

function getDynamicLocalDevHosts(): readonly string[] {
    const hosts = new Set<string>(STATIC_LOCAL_DEV_HOSTS);
    if (isLocalDevelopmentHost(window.location.hostname)) {
        hosts.add(window.location.hostname);
    }

    return [...hosts];
}

function isLocalDevelopmentHost(hostname: string): boolean {
    const normalized = hostname.trim().toLowerCase();
    if (!normalized) {
        return false;
    }

    if (normalized === "localhost" || normalized === "127.0.0.1") {
        return true;
    }

    if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(normalized)) {
        return true;
    }

    if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(normalized)) {
        return true;
    }

    return /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(normalized);
}
