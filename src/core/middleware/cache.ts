/**
 * Cache control middleware
 *
 * Sets appropriate Cache-Control headers for different types of responses.
 * Public data can be cached, private/user-specific data should not be.
 *
 * @see {@link ../../../ai/middleware_architecture.md} for middleware patterns
 */

import { Request, Response, NextFunction } from 'express';

/**
 * Disable caching for private/user-specific data
 *
 * Sets headers to prevent any caching of the response.
 * Use for endpoints that return user-specific data.
 *
 * @example
 * ```typescript
 * router.get('/:userid/watchlist', noCache, getWatchlist);
 * ```
 */
export const noCache = (
    req: Request,
    res: Response,
    next: NextFunction
): void => {
    res.set({
        'Cache-Control': 'no-store, no-cache, must-revalidate, private',
        'Pragma': 'no-cache',
        'Expires': '0'
    });
    next();
};

/**
 * Enable public caching for specified duration
 *
 * Allows browsers and CDNs to cache public data for the specified time.
 * Use for endpoints that return public, non-user-specific data.
 *
 * @param maxAge Cache duration in seconds
 * @returns Middleware function
 *
 * @example
 * ```typescript
 * router.get('/avatar/all', cachePublic(3600), getAllAvatars); // Cache for 1 hour
 * ```
 */
export const cachePublic = (maxAge: number) => {
    return (req: Request, res: Response, next: NextFunction): void => {
        res.set({
            'Cache-Control': `public, max-age=${maxAge}`,
            'Expires': new Date(Date.now() + maxAge * 1000).toUTCString()
        });
        next();
    };
};

/**
 * Enable private caching for specified duration
 *
 * Allows browser caching but not CDN/proxy caching.
 * Use for user-specific data that doesn't change frequently.
 *
 * @param maxAge Cache duration in seconds
 * @returns Middleware function
 *
 * @example
 * ```typescript
 * router.get('/:userid/avatar', cachePrivate(300), getUserAvatar); // Cache for 5 min
 * ```
 */
export const cachePrivate = (maxAge: number) => {
    return (req: Request, res: Response, next: NextFunction): void => {
        res.set({
            'Cache-Control': `private, max-age=${maxAge}`,
            'Expires': new Date(Date.now() + maxAge * 1000).toUTCString()
        });
        next();
    };
};

/**
 * Conditional caching based on response status
 *
 * Only caches successful (2xx) responses, errors are never cached.
 *
 * @param maxAge Cache duration in seconds for successful responses
 * @returns Middleware function
 */
export const conditionalCache = (maxAge: number) => {
    return (req: Request, res: Response, next: NextFunction): void => {
        const originalJson = res.json.bind(res);
        
        res.json = function(body: any) {
            // Only cache successful responses
            if (res.statusCode >= 200 && res.statusCode < 300) {
                res.set({
                    'Cache-Control': `public, max-age=${maxAge}`,
                });
            } else {
                res.set({
                    'Cache-Control': 'no-store',
                });
            }
            
            return originalJson(body);
        };
        
        next();
    };
};
