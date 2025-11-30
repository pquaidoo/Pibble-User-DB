/**
 * Authentication middleware
 *
 * Verifies user authentication via JWT tokens or API keys.
 * Attaches authenticated user information to the request object.
 *
 * @see {@link ../../../ai/middleware_architecture.md} for middleware patterns
 */

import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '@/types';

/**
 * Authenticate user via JWT token or API key
 *
 * Checks for authentication credentials in the Authorization header.
 * Supports two formats:
 * - Bearer token: "Authorization: Bearer <jwt_token>"
 * - API key: "Authorization: ApiKey <api_key>"
 *
 * On success, attaches user object to request.user
 * On failure, returns 401 Unauthorized
 *
 * @example
 * ```typescript
 * router.get('/:userid/watchlist', authenticate, getWatchlist);
 * ```
 */
export const authenticate = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader) {
            res.status(401).json({
                error: 'Authorization header missing',
                code: 'UNAUTHORIZED',
                timestamp: new Date().toISOString()
            });
            return;
        }

        // Check for Bearer token
        if (authHeader.startsWith('Bearer ')) {
            const token = authHeader.substring(7);
            const user = await verifyJWT(token);
            
            (req as AuthenticatedRequest).user = user;
            next();
            return;
        }

        // Check for API key
        if (authHeader.startsWith('ApiKey ')) {
            const apiKey = authHeader.substring(7);
            const user = await verifyApiKey(apiKey);
            
            (req as AuthenticatedRequest).user = user;
            next();
            return;
        }

        // Invalid authorization format
        res.status(401).json({
            error: 'Invalid authorization format. Use "Bearer <token>" or "ApiKey <key>"',
            code: 'UNAUTHORIZED',
            timestamp: new Date().toISOString()
        });
    } catch (error: any) {
        res.status(401).json({
            error: error.message || 'Authentication failed',
            code: 'UNAUTHORIZED',
            timestamp: new Date().toISOString()
        });
    }
};

/**
 * Verify JWT token and return user information
 *
 * TODO: Implement actual JWT verification
 * This is a placeholder - replace with your JWT library (e.g., jsonwebtoken)
 *
 * @param token JWT token string
 * @returns Authenticated user object
 * @throws Error if token is invalid
 */
async function verifyJWT(token: string): Promise<{ user_id: string; email?: string }> {
    // TODO: Replace this with actual JWT verification
    // Example using jsonwebtoken:
    // import jwt from 'jsonwebtoken';
    // const decoded = jwt.verify(token, process.env.JWT_SECRET!);
    // return { user_id: decoded.userId, email: decoded.email };
    
    // Placeholder implementation
    if (!token || token.length < 10) {
        throw new Error('Invalid JWT token');
    }

    // For now, just return a mock user
    // REPLACE THIS IN PRODUCTION!
    return {
        user_id: '123',
        email: 'user@example.com'
    };
}

/**
 * Verify API key and return user information
 *
 * TODO: Implement actual API key verification
 * This should query your database to validate the API key
 *
 * @param apiKey API key string
 * @returns Authenticated user object
 * @throws Error if API key is invalid
 */
async function verifyApiKey(apiKey: string): Promise<{ user_id: string }> {
    // TODO: Replace with actual API key verification
    // Example:
    // const user = await db.query('SELECT user_id FROM api_keys WHERE key = $1', [apiKey]);
    // if (!user) throw new Error('Invalid API key');
    // return { user_id: user.user_id };
    
    // Placeholder implementation
    if (!apiKey || apiKey.length < 32) {
        throw new Error('Invalid API key');
    }

    // For now, just return a mock user
    // REPLACE THIS IN PRODUCTION!
    return {
        user_id: '123'
    };
}

/**
 * Optional authentication
 *
 * Attempts to authenticate the user, but allows the request to proceed
 * even if authentication fails. Useful for endpoints that have different
 * behavior for authenticated vs anonymous users.
 *
 * @example
 * ```typescript
 * router.get('/items', optionalAuth, getItems); // Shows public + user's private items if authenticated
 * ```
 */
export const optionalAuth = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader) {
            next(); // No auth provided, continue anyway
            return;
        }

        // Try to authenticate
        if (authHeader.startsWith('Bearer ')) {
            const token = authHeader.substring(7);
            const user = await verifyJWT(token);
            (req as AuthenticatedRequest).user = user;
        } else if (authHeader.startsWith('ApiKey ')) {
            const apiKey = authHeader.substring(7);
            const user = await verifyApiKey(apiKey);
            (req as AuthenticatedRequest).user = user;
        }
        
        next();
    } catch (error) {
        // Authentication failed, but we allow the request to continue
        next();
    }
};
