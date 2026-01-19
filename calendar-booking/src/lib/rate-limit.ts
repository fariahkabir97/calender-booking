// Simple in-memory rate limiter
// In production, use Redis for distributed rate limiting

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

interface RateLimitOptions {
  windowMs: number; // Time window in milliseconds
  max: number; // Max requests per window
}

export function rateLimit(key: string, options: RateLimitOptions): { success: boolean; remaining: number; resetAt: Date } {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  // Clean up old entry or create new one
  if (!entry || entry.resetAt <= now) {
    rateLimitStore.set(key, {
      count: 1,
      resetAt: now + options.windowMs,
    });
    return {
      success: true,
      remaining: options.max - 1,
      resetAt: new Date(now + options.windowMs),
    };
  }

  // Increment count
  entry.count += 1;

  if (entry.count > options.max) {
    return {
      success: false,
      remaining: 0,
      resetAt: new Date(entry.resetAt),
    };
  }

  return {
    success: true,
    remaining: options.max - entry.count,
    resetAt: new Date(entry.resetAt),
  };
}

// Rate limit configuration for different endpoints
export const RATE_LIMITS = {
  // Public booking endpoint: 10 requests per minute per IP
  booking: { windowMs: 60 * 1000, max: 10 },
  // Availability endpoint: 30 requests per minute per IP
  availability: { windowMs: 60 * 1000, max: 30 },
  // OAuth: 5 requests per minute per user
  oauth: { windowMs: 60 * 1000, max: 5 },
};

// Helper to get client IP from request
export function getClientIP(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  const realIP = request.headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }
  return 'unknown';
}
