/**
 * Returns the base API URL, dynamically using the current browser hostname.
 * This ensures LAN devices reach the correct backend instead of their own localhost.
 */
export function getApiBaseUrl(): string {
    // If env var is explicitly set, always use it
    if (process.env.NEXT_PUBLIC_API_URL) {
        return process.env.NEXT_PUBLIC_API_URL;
    }
    // In the browser, use the same hostname the page was loaded from
    if (typeof window !== 'undefined') {
        return `${window.location.protocol}//${window.location.hostname}:8000`;
    }
    // SSR fallback
    return "http://localhost:8000";
}

/** Convenience: returns full API URL for a given path */
export function getApiUrl(path: string): string {
    return `${getApiBaseUrl()}${path}`;
}
