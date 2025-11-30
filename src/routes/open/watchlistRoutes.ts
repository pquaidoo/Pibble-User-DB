/**
 * Watchlist Routes
 *
 * Defines all routes for watchlist operations.
 * Implements complete middleware chain as specified in middleware_architecture.md
 */

import { Router } from 'express';
import * as watchlistController from '../../controllers/watchlistController';

// Middleware imports
import { authenticate } from '@middleware/authentication';
import { requireOwnUser } from '@middleware/authorization';
import {
    validateUserIdParam,
    validateMediaIdParam,
    validateMediaItemBody
} from '@middleware/validation';
import { sanitizeBody } from '@middleware/sanitization';
import { readRateLimit, writeRateLimit } from '@middleware/rateLimit';
import { noCache } from '@middleware/cache';

export const watchlistRoutes = Router();

/**
 * GET /:userid/watchlist
 *
 * Get all watchlist items for a user
 *
 * Middleware chain:
 * 1. Rate limiting (read)
 * 2. Authentication
 * 3. Authorization (own user)
 * 4. Parameter validation
 * 5. Cache control (no cache for user data)
 */
watchlistRoutes.get(
    '/:userid/watchlist',
    readRateLimit,           // 100 req/min
    authenticate,            // Must be logged in
    requireOwnUser,          // Can only access own data
    validateUserIdParam,     // Validate userid format
    noCache,                 // Don't cache user data
    watchlistController.getWatchlist
);

/**
 * POST /:userid/watchlist
 *
 * Add item to watchlist
 *
 * Middleware chain:
 * 1. Rate limiting (write) - stricter
 * 2. Sanitize input
 * 3. Authentication
 * 4. Authorization (own user)
 * 5. Parameter validation
 * 6. Body validation
 */
watchlistRoutes.post(
    '/:userid/watchlist',
    writeRateLimit,          // 30 req/min (stricter for writes)
    sanitizeBody,            // Clean input
    authenticate,            // Must be logged in
    requireOwnUser,          // Can only modify own data
    validateUserIdParam,     // Validate userid format
    validateMediaItemBody,   // Validate request body
    watchlistController.addToWatchlist
);

/**
 * DELETE /:userid/watchlist/:mediaid
 *
 * Delete single watchlist item
 *
 * Middleware chain:
 * 1. Rate limiting (write)
 * 2. Authentication
 * 3. Authorization (own user)
 * 4. Parameter validation
 */
watchlistRoutes.delete(
    '/:userid/watchlist/:mediaid',
    writeRateLimit,          // 30 req/min
    authenticate,            // Must be logged in
    requireOwnUser,          // Can only modify own data
    validateUserIdParam,     // Validate userid format
    validateMediaIdParam,    // Validate mediaid format
    watchlistController.deleteWatchlistItem
);

/**
 * DELETE /:userid/watchlist
 *
 * Delete all watchlist items for a user
 *
 * Middleware chain:
 * 1. Rate limiting (write)
 * 2. Authentication
 * 3. Authorization (own user)
 * 4. Parameter validation
 */
watchlistRoutes.delete(
    '/:userid/watchlist',
    writeRateLimit,          // 30 req/min
    authenticate,            // Must be logged in
    requireOwnUser,          // Can only modify own data
    validateUserIdParam,     // Validate userid format
    watchlistController.deleteAllWatchlist
);