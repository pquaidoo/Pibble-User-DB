/**
 * Rate limiting middleware
 *
 * Prevents abuse by limiting the number of requests a user/IP can make
 * within a time window. Different limits for read vs write operations.
 *
 * @see {@link ../../../ai/middleware_architecture.md} for middleware patterns
 */

import rateLimit from 'express-rate-limit';

/**
 * Rate limiter for read operations (GET requests)
 *
 * Allows 100 requests per minute for read operations.
 *
 * @example
 * ```typescript
 * router.get('/:userid/watchlist', readRateLimit, getWatchlist);
 * ```
 */
export const readRateLimit = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 100, // 100 requests per minute
    message: {
        error: 'Too many requests. Please try again later.',
        code: 'RATE_LIMIT_EXCEEDED',
        timestamp: new Date().toISOString()
    },
    standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
    legacyHeaders: false, // Disable `X-RateLimit-*` headers
});

/**
 * Rate limiter for write operations (POST/PUT/PATCH/DELETE requests)
 *
 * Allows 30 requests per minute for write operations.
 * Stricter than read limit to prevent abuse.
 *
 * @example
 * ```typescript
 * router.post('/:userid/watchlist', writeRateLimit, addToWatchlist);
 * ```
 */
export const writeRateLimit = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 30, // 30 requests per minute
    message: {
        error: 'Too many write requests. Please try again later.',
        code: 'RATE_LIMIT_EXCEEDED',
        timestamp: new Date().toISOString()
    },
    standardHeaders: true,
    legacyHeaders: false,
});

/**
 * Rate limiter for avatar operations
 *
 * Allows 10 requests per hour for avatar changes.
 * Very strict to prevent rapid avatar switching abuse.
 *
 * @example
 * ```typescript
 * router.patch('/:userid/avatar', avatarRateLimit, updateAvatar);
 * ```
 */
export const avatarRateLimit = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // 10 requests per hour
    message: {
        error: 'Too many avatar changes. Please try again later.',
        code: 'RATE_LIMIT_EXCEEDED',
        timestamp: new Date().toISOString()
    },
    standardHeaders: true,
    legacyHeaders: false,
});
