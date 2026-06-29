import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private cache = new Map<string, { value: any; expiresAt: number }>();

  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.logger.debug(`Cache expired for key: ${key}`);
      return null;
    }
    this.logger.debug(`Cache hit for key: ${key}`);
    return entry.value as T;
  }

  async set(key: string, value: any, ttlSeconds = 60): Promise<void> {
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
    this.logger.debug(`Cache set for key: ${key} with TTL ${ttlSeconds}s`);
  }

  async del(key: string): Promise<void> {
    this.cache.delete(key);
    this.logger.debug(`Cache deleted for key: ${key}`);
  }

  async invalidatePattern(pattern: string): Promise<void> {
    let count = 0;
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
        count++;
      }
    }
    if (count > 0) {
      this.logger.debug(
        `Invalidated ${count} cache keys matching pattern: ${pattern}`,
      );
    }
  }

  async clear(): Promise<void> {
    this.cache.clear();
    this.logger.debug('Cache cleared completely');
  }
}
