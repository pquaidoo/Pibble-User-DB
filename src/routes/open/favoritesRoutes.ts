/**
 * Favorites Routes
 *
 * Defines all routes for favorites operations.
 * Implements complete middleware chain as specified in middleware_architecture.md
 */

import { Router } from 'express';
import * as favoritesController from '../../controllers/favoritesController';

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

export const favoritesRoutes = Router();

/**
 * GET /:userid/favorites
 * Get all favorite items for a user
 */
favoritesRoutes.get(
    '/:userid/favorites',
    readRateLimit,
    authenticate,
    requireOwnUser,
    validateUserIdParam,
    noCache,
    favoritesController.getFavorites
);

/**
 * POST /:userid/favorites
 * Add item to favorites
 */
favoritesRoutes.post(
    '/:userid/favorites',
    writeRateLimit,
    sanitizeBody,
    authenticate,
    requireOwnUser,
    validateUserIdParam,
    validateMediaItemBody,
    favoritesController.addToFavorites
);

/**
 * DELETE /:userid/favorites/:mediaid
 * Delete single favorite item
 */
favoritesRoutes.delete(
    '/:userid/favorites/:mediaid',
    writeRateLimit,
    authenticate,
    requireOwnUser,
    validateUserIdParam,
    validateMediaIdParam,
    favoritesController.deleteFavoriteItem
);

/**
 * DELETE /:userid/favorites
 * Delete all favorite items for a user
 */
favoritesRoutes.delete(
    '/:userid/favorites',
    writeRateLimit,
    authenticate,
    requireOwnUser,
    validateUserIdParam,
    favoritesController.deleteAllFavorites
);