import * as vscode from 'vscode';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

/**
 * Cache service using VS Code's globalState for persistence
 */
export class CacheService {
  private context: vscode.ExtensionContext;
  private memoryCache: Map<string, CacheEntry<unknown>> = new Map();
  private readonly cachePrefix = 'hcCache_';

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  /**
   * Get a value from cache
   */
  async get<T>(key: string): Promise<T | undefined> {
    const fullKey = this.cachePrefix + key;

    // Check memory cache first
    const memEntry = this.memoryCache.get(fullKey) as CacheEntry<T> | undefined;
    if (memEntry && !this.isExpired(memEntry)) {
      return memEntry.data;
    }

    // Check persistent cache
    const persistedEntry = this.context.globalState.get<CacheEntry<T>>(fullKey);
    if (persistedEntry && !this.isExpired(persistedEntry)) {
      // Refresh memory cache
      this.memoryCache.set(fullKey, persistedEntry);
      return persistedEntry.data;
    }

    return undefined;
  }

  /**
   * Set a value in cache with TTL in milliseconds
   */
  async set<T>(key: string, data: T, ttlMs: number, persist = true): Promise<void> {
    const fullKey = this.cachePrefix + key;
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl: ttlMs
    };

    // Always set in memory cache
    this.memoryCache.set(fullKey, entry);

    // Optionally persist
    if (persist) {
      await this.context.globalState.update(fullKey, entry);
    }
  }

  /**
   * Remove a value from cache
   */
  async delete(key: string): Promise<void> {
    const fullKey = this.cachePrefix + key;
    this.memoryCache.delete(fullKey);
    await this.context.globalState.update(fullKey, undefined);
  }

  /**
   * Clear all cached values
   */
  async clear(): Promise<void> {
    this.memoryCache.clear();
    
    // Clear persisted cache entries
    const keys = this.context.globalState.keys();
    for (const key of keys) {
      if (key.startsWith(this.cachePrefix)) {
        await this.context.globalState.update(key, undefined);
      }
    }
  }

  /**
   * Check if an entry has expired
   */
  private isExpired(entry: CacheEntry<unknown>): boolean {
    return Date.now() - entry.timestamp > entry.ttl;
  }

  /**
   * Get cache statistics
   */
  getStats(): { memoryEntries: number; persistedEntries: number } {
    const keys = this.context.globalState.keys();
    const persistedCount = keys.filter(k => k.startsWith(this.cachePrefix)).length;
    
    return {
      memoryEntries: this.memoryCache.size,
      persistedEntries: persistedCount
    };
  }
}

// Cache TTL constants
export const CacheTTL = {
  NPI_LOOKUP: 24 * 60 * 60 * 1000, // 24 hours
  NDC_LOOKUP: 24 * 60 * 60 * 1000, // 24 hours
  LCD_LOOKUP: 7 * 24 * 60 * 60 * 1000, // 7 days
  STATE_LAW: 24 * 60 * 60 * 1000, // 24 hours
  FORMULA_CHECK: 7 * 24 * 60 * 60 * 1000, // 7 days
} as const;
