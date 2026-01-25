import { Redis } from '@upstash/redis';

let redis: Redis | null = null;

export function getRedis(): Redis | null {
  if (redis) return redis;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    console.log('⚠️ Upstash Redis not configured, caching disabled');
    return null;
  }

  redis = new Redis({ url, token });
  console.log('✅ Upstash Redis connected for caching');
  return redis;
}

// Cache helper functions
export async function cacheGet<T>(key: string): Promise<T | null> {
  const client = getRedis();
  if (!client) return null;

  try {
    const data = await client.get<T>(key);
    return data;
  } catch (error) {
    console.error('Redis GET error:', error);
    return null;
  }
}

export async function cacheSet(
  key: string,
  value: unknown,
  expirySeconds: number = 300 // 5 minutes default
): Promise<boolean> {
  const client = getRedis();
  if (!client) return false;

  try {
    await client.setex(key, expirySeconds, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error('Redis SET error:', error);
    return false;
  }
}

export async function cacheDelete(key: string): Promise<boolean> {
  const client = getRedis();
  if (!client) return false;

  try {
    await client.del(key);
    return true;
  } catch (error) {
    console.error('Redis DEL error:', error);
    return false;
  }
}

export async function cacheDeletePattern(pattern: string): Promise<boolean> {
  const client = getRedis();
  if (!client) return false;

  try {
    // Upstash doesn't support KEYS command in free tier, so we use SCAN
    let cursor: number = 0;
    do {
      const result = await client.scan(cursor, { match: pattern, count: 100 });
      cursor = Number(result[0]);
      const keys = result[1] as string[];
      if (keys.length > 0) {
        await Promise.all(keys.map((key) => client.del(key)));
      }
    } while (cursor !== 0);
    return true;
  } catch (error) {
    console.error('Redis pattern delete error:', error);
    return false;
  }
}

// Cache keys
export const CACHE_KEYS = {
  PRODUCTS_LIST: 'products:list',
  PRODUCT_BY_SLUG: (slug: string) => `products:slug:${slug}`,
  PRODUCT_BY_ID: (id: string) => `products:id:${id}`,
  USER_LIBRARY: (userId: string) => `library:user:${userId}`,
};

// Cache TTL (in seconds)
export const CACHE_TTL = {
  PRODUCTS_LIST: 60, // 1 minute
  PRODUCT_DETAIL: 300, // 5 minutes
  USER_LIBRARY: 60, // 1 minute
};
