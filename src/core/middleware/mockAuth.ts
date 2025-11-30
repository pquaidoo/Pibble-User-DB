/**
 * MOCK AUTHENTICATION MIDDLEWARE - FOR TESTING ONLY
 *
 * TODO: DELETE THIS FILE WHEN IMPLEMENTING REAL AUTHENTICATION
 *
 * This middleware temporarily populates request.user based on the userId
 * route parameter to allow testing of authorization and controller logic
 * without implementing full JWT authentication.
 */

import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '@/types';

/**
 * Mock authentication middleware that sets request.user from route params
 *
 * WARNING: This is insecure and only for development/testing!
 * Replace with proper JWT authentication before production.
 */
export const mockAuthenticateUser = (
    request: Request,
    response: Response,
    next: NextFunction
): void => {
    const authReq = request as AuthenticatedRequest;
    const { userId } = authReq.params;

    // Handle missing userId parameter
    if (!userId) {
        response.status(401).json({
            success: false,
            message: 'Authentication required - userId missing'
        });
        return;
    }

    // Mock: Set user based on route parameter
    // In real auth, this would come from validating a JWT token
    authReq.user = {
        user_id: userId,
        email: `user${userId}@example.com`,
        username: `user${userId}`
    };

    next();
};