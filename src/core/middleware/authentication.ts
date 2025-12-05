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
import jwt from 'jsonwebtoken';
import { config } from '@utilities/envConfig';

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
 * Verifies the JWT token using the configured secret key and extracts
 * user information from the token payload.
 *
 * @param token JWT token string
 * @returns Authenticated user object
 * @throws Error if token is invalid or verification fails
 */
async function verifyJWT(token: string): Promise<{ user_id: string; email?: string; username?: string }> {
    if (!token || token.length < 10) {
        throw new Error('Invalid JWT token');
    }

    // ============================================================================
    // TEMPORARY: JWT verification bypassed for development
    //
    // TO RE-ENABLE PROPER JWT VERIFICATION:
    // 1. Get JWT_SECRET from Credentials API team
    // 2. Add JWT_SECRET=<the-secret> to your .env file
    // 3. Comment out the TEMP section below (lines 109-126)
    // 4. Uncomment the PRODUCTION section below (lines 128-157)
    // ============================================================================

    // TEMP: Decode without verification (INSECURE - DEVELOPMENT ONLY!)
    try {
        const parts = token.split('.');
        if (parts.length !== 3) {
            throw new Error('Invalid token format');
        }

        const payloadBase64 = parts[1];
        if (!payloadBase64) {
            throw new Error('Token payload is missing');
        }

        const payload = JSON.parse(Buffer.from(payloadBase64, 'base64').toString());
        const userId = payload.user_id || payload.userId || payload.id || payload.sub;

        if (!userId) {
            throw new Error('Token payload missing user identifier');
        }

        return {
            user_id: String(userId),
            email: payload.email,
            username: payload.username || payload.name
        };
    } catch (error: any) {
        throw new Error('Failed to decode JWT token: ' + error.message);
    }

    /* PRODUCTION CODE - UNCOMMENT WHEN YOU HAVE JWT_SECRET:

    if (!config.JWT_SECRET) {
        throw new Error('JWT_SECRET is not configured');
    }

    try {
        // Verify and decode the JWT token
        const decoded = jwt.verify(token, config.JWT_SECRET) as any;

        // Extract user information from token payload
        // Support multiple field name variations (user_id, userId, id, sub)
        const userId = decoded.user_id || decoded.userId || decoded.id || decoded.sub;

        if (!userId) {
            throw new Error('Token payload missing user identifier');
        }

        // Return user object with consistent field names
        return {
            user_id: String(userId), // Ensure it's always a string
            email: decoded.email,
            username: decoded.username || decoded.name
        };
    } catch (error: any) {
        if (error.name === 'TokenExpiredError') {
            throw new Error('JWT token has expired');
        }
        if (error.name === 'JsonWebTokenError') {
            throw new Error('Invalid JWT token');
        }
        throw new Error(error.message || 'JWT verification failed');
    }

    */ // END PRODUCTION CODE
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
