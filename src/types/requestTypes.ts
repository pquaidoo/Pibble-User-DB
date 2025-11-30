/**
 * Request type definitions for Express handlers
 *
 * Extended request types that include authentication and authorization
 * context for type-safe access to user information in route handlers.
 *
 * @see {@link ../../docs/typescript-patterns.md#type-organization} for type organization patterns
 */

import { Request } from 'express';

/**
 * User information attached to authenticated requests
 *
 * Represents the authenticated user's data that gets attached to
 * the request object after successful authentication.
 */
export interface AuthenticatedUser {
    /** Unique identifier for the authenticated user */
    user_id: string;

    /** User's email address */
    email?: string;
    /** User's username or display name */
    username?: string;
    /** Additional user metadata that may be needed */
    [key: string]: any;
}

/**
 * Extended Express Request with authenticated user information
 *
 * Type-safe wrapper for Express Request that includes the authenticated
 * user object. Use this type in route handlers that require authentication.
 *
 * @example
 * ```typescript
 * export const getWatchlist = asyncHandler(
 *   async (request: AuthenticatedRequest, response: Response): Promise<void> => {
 *     const userId = request.user.user_id; // Type-safe access to user
 *     // ...
 *   }
 * );
 * ```
 */
export interface AuthenticatedRequest extends Request {
    /** The authenticated user object (populated by auth middleware) */
    user: AuthenticatedUser;
}