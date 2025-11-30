/**
 * Authorization middleware for resource access control
 *
 * Provides middleware functions to verify that authenticated users
 * have permission to access specific resources.
 *
 * @see {@link ../../../docs/error-handling-patterns.md} for error handling strategies
 */

import { Request, Response, NextFunction, RequestHandler } from 'express';
import { AppError } from '@middleware/errorHandler';
import { ErrorCodes, AuthenticatedRequest } from '@/types';

/**
 * Middleware to verify that the authenticated user matches the requested userId
 *
 * Ensures users can only access their own resources by comparing the
 * authenticated user's ID (from request.user.id) with the userId parameter
 * in the route. Returns 403 Forbidden if there's a mismatch.
 *
 * @example
 * ```typescript
 * router.get('/:userId/watchlist', requireOwnUser, getWatchlist);
 * ```
 */
export const requireOwnUser: RequestHandler = (
    request: Request,
    response: Response,
    next: NextFunction
): void => {
    const AuthenticatedReq = request as AuthenticatedRequest;
    const { userid } = AuthenticatedReq.params;

    // Verify authenticated user matches the requested userid
    if (AuthenticatedReq.user.user_id !== userid) {
        const error = new AppError(
            'You do not have permission to access this resource',
            403,
            ErrorCodes.FORBIDDEN
        );
        next(error);
        return;
    }

    // User is authorized, proceed to next middleware/controller
    next();
};