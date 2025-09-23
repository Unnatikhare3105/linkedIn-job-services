import { v4 as uuidv4 } from "uuid";
import redisClient from "../config/redis.js";
import { generateSecureId } from "./security.js";

// Distributed locking utility
export async function withLock(key, timeoutMs, callback) {
  const lockKey = `lock:${key}`;
  const lockTimeout = timeoutMs / 1000;
  const lockValue = generateSecureId();
  try {
    const acquired = await redisClient.set(lockKey, lockValue, { NX: true, EX: lockTimeout });
    if (!acquired) throw new Error("Failed to acquire lock");
    return await callback();
  } finally {
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      end
      return 0
    `;
    await redisClient.eval(script, { keys: [lockKey], arguments: [lockValue] });
  }
}

// Utility function for retry with exponential backoff
export async function withRetry(operation, maxAttempts = 3, baseDelay = 100) {
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt === maxAttempts) break;
      const delay = baseDelay * Math.pow(2, attempt - 1);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}