interface Entry<T> {
    data: T;
    fetchedAt: number;
}

const store = new Map<string, Entry<unknown>>();

const DEFAULT_TTL = 60_000;

/**
 * Stale-while-revalidate cache.
 * - Fresh (< ttl): returns cache, no network call.
 * - Stale (>= ttl): returns cache immediately, revalidates in background.
 * - Empty: fetches, blocks until resolved, stores result.
 */
export function cached<T>(key: string, fetcher: () => Promise<T>, ttl = DEFAULT_TTL): Promise<T> {
    const entry = store.get(key) as Entry<T> | undefined;
    const now = Date.now();

    if (entry) {
        if (now - entry.fetchedAt < ttl) {
            return Promise.resolve(entry.data);
        }
        // Stale — return immediately and refresh behind the scenes
        fetcher().then((data) => store.set(key, { data, fetchedAt: Date.now() })).catch(() => {});
        return Promise.resolve(entry.data);
    }

    return fetcher().then((data) => {
        if (data !== null && data !== undefined) store.set(key, { data, fetchedAt: Date.now() });
        return data;
    });
}

export function invalidate(...keys: string[]) {
    for (const k of keys) store.delete(k);
}

export function invalidateAll() {
    store.clear();
}

export function prime<T>(key: string, data: T) {
    store.set(key, { data, fetchedAt: Date.now() });
}
