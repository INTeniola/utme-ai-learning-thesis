/**
 * queryCache — ultra-lightweight in-memory cache for Supabase query results.
 *
 * Goals:
 *  - Instant Back-navigation: cached data is returned synchronously before
 *    the component re-fetches, so the UI is never blank when navigating back.
 *  - Reduced DB load: identical queries within the TTL window are skipped.
 *  - Zero dependencies: no external library required.
 *
 * Usage:
 *   const cached = queryCache.get<T>('myKey', 60_000);
 *   if (cached) return cached;
 *   const data = await supabase.from(...).select(...);
 *   queryCache.set('myKey', data);
 *
 * TTL defaults to 60 seconds. Call queryCache.invalidate('prefix') after
 * a write to force a re-fetch on next access.
 */

interface CacheEntry<T> {
    data: T;
    ts: number; // Date.now() at time of storage
}

class QueryCache {
    private store = new Map<string, CacheEntry<unknown>>();

    /** Returns cached data if present and not expired, otherwise null. */
    get<T>(key: string, ttlMs = 60_000): T | null {
        const entry = this.store.get(key) as CacheEntry<T> | undefined;
        if (!entry) return null;
        if (Date.now() - entry.ts > ttlMs) {
            this.store.delete(key);
            return null;
        }
        return entry.data;
    }

    /** Stores data under key with the current timestamp. */
    set<T>(key: string, data: T): void {
        this.store.set(key, { data, ts: Date.now() });
    }

    /** Deletes all keys whose names start with the given prefix. */
    invalidate(prefix: string): void {
        for (const key of this.store.keys()) {
            if (key.startsWith(prefix)) {
                this.store.delete(key);
            }
        }
    }

    /** Clears the entire cache. */
    clear(): void {
        this.store.clear();
    }
}

// Singleton — shared across all hooks and components
export const queryCache = new QueryCache();
