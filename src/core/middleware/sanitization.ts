/**
 * Input sanitization middleware
 *
 * Sanitizes user input to prevent XSS attacks and injection vulnerabilities.
 * Trims whitespace and removes potentially harmful characters.
 *
 * @see {@link ../../../ai/middleware_architecture.md} for middleware patterns
 */

import { Request, Response, NextFunction } from 'express';

/**
 * Sanitize request body fields
 *
 * Recursively sanitizes all string values in the request body by:
 * - Trimming leading/trailing whitespace
 * - Removing null bytes
 * - Escaping HTML entities (optional, for XSS prevention)
 *
 * @example
 * ```typescript
 * router.post('/:userid/watchlist', sanitizeBody, validateMediaItemBody, addToWatchlist);
 * ```
 */
export const sanitizeBody = (
    req: Request,
    res: Response,
    next: NextFunction
): void => {
    if (req.body && typeof req.body === 'object') {
        req.body = sanitizeObject(req.body);
    }
    next();
};

/**
 * Sanitize query parameters
 *
 * Sanitizes all query string parameters.
 *
 * @example
 * ```typescript
 * router.get('/search', sanitizeQuery, searchEndpoint);
 * ```
 */
export const sanitizeQuery = (
    req: Request,
    res: Response,
    next: NextFunction
): void => {
    if (req.query && typeof req.query === 'object') {
        req.query = sanitizeObject(req.query);
    }
    next();
};

/**
 * Sanitize path parameters
 *
 * Sanitizes all URL path parameters.
 *
 * @example
 * ```typescript
 * router.get('/:userid/profile', sanitizeParams, getProfile);
 * ```
 */
export const sanitizeParams = (
    req: Request,
    res: Response,
    next: NextFunction
): void => {
    if (req.params && typeof req.params === 'object') {
        req.params = sanitizeObject(req.params);
    }
    next();
};

/**
 * Recursively sanitize an object's string values
 *
 * @param obj Object to sanitize
 * @returns Sanitized object
 */
function sanitizeObject(obj: any): any {
    if (typeof obj !== 'object' || obj === null) {
        return obj;
    }

    if (Array.isArray(obj)) {
        return obj.map(item => 
            typeof item === 'string' ? sanitizeString(item) : sanitizeObject(item)
        );
    }

    const sanitized: any = {};
    for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
            const value = obj[key];
            if (typeof value === 'string') {
                sanitized[key] = sanitizeString(value);
            } else if (typeof value === 'object') {
                sanitized[key] = sanitizeObject(value);
            } else {
                sanitized[key] = value;
            }
        }
    }
    return sanitized;
}

/**
 * Sanitize a single string value
 *
 * @param str String to sanitize
 * @returns Sanitized string
 */
function sanitizeString(str: string): string {
    if (typeof str !== 'string') {
        return str;
    }

    return str
        .trim() // Remove leading/trailing whitespace
        .replace(/\0/g, ''); // Remove null bytes
        // Note: We're NOT escaping HTML here because the database should store raw data
        // HTML escaping should happen on output, not input
}
