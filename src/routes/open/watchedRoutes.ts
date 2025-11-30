/**
 * Watched Routes
 *
 * Defines all routes for watched history operations.
 * Implements complete middleware chain as specified in middleware_architecture.md
 */

import { Router } from 'express';
import * as watchedController from '../../controllers/watchedController';

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

export const watchedRoutes = Router();

/**
 * GET /:userid/watched
 * Get all watched items for a user
 */
watchedRoutes.get(
    '/:userid/watched',
    readRateLimit,
    authenticate,
    requireOwnUser,
    validateUserIdParam,
    noCache,
    watchedController.getWatched
);

/**
 * POST /:userid/watched
 * Add item to watched history
 */
watchedRoutes.post(
    '/:userid/watched',
    writeRateLimit,
    sanitizeBody,
    authenticate,
    requireOwnUser,
    validateUserIdParam,
    validateMediaItemBody,
    watchedController.addToWatched
);

/**
 * DELETE /:userid/watched/:mediaid
 * Delete single watched item
 */
watchedRoutes.delete(
    '/:userid/watched/:mediaid',
    writeRateLimit,
    authenticate,
    requireOwnUser,
    validateUserIdParam,
    validateMediaIdParam,
    watchedController.deleteWatchedItem
);

/**
 * DELETE /:userid/watched
 * Delete all watched items for a user
 */
watchedRoutes.delete(
    '/:userid/watched',
    writeRateLimit,
    authenticate,
    requireOwnUser,
    validateUserIdParam,
    watchedController.deleteAllWatched
);