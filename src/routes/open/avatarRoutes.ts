/**
 * Avatar Routes
 *
 * Defines all routes for avatar operations.
 * Implements complete middleware chain as specified in middleware_architecture.md
 */

import { Router } from 'express';
import * as avatarController from '../../controllers/avatarController';

// Middleware imports
import { authenticate } from '@middleware/authentication';
import { requireOwnUser } from '@middleware/authorization';
import {
    validateUserIdParam,
    validateAvatarBody
} from '@middleware/validation';
import { sanitizeBody } from '@middleware/sanitization';
import { readRateLimit, avatarRateLimit } from '@middleware/rateLimit';
import { noCache, cachePublic, cachePrivate } from '@middleware/cache';

export const avatarRoutes = Router();

/**
 * GET /avatar/all
 * Get all available avatars (PUBLIC ENDPOINT)
 *
 * No authentication required - this is public data
 */
avatarRoutes.get(
    '/avatar/all',
    readRateLimit,
    cachePublic(3600),  // Cache for 1 hour (public data)
    avatarController.getAllAvatars
);

/**
 * GET /:userid/avatar
 * Get user's current avatar
 */
avatarRoutes.get(
    '/:userid/avatar',
    readRateLimit,
    authenticate,
    requireOwnUser,
    validateUserIdParam,
    cachePrivate(300),  // Cache for 5 minutes (user-specific)
    avatarController.getUserAvatar
);

/**
 * PATCH /:userid/avatar
 * Update user's avatar
 *
 * Uses stricter rate limiting (10 req/hour)
 */
avatarRoutes.patch(
    '/:userid/avatar',
    avatarRateLimit,    // 10 req/hour (very strict)
    sanitizeBody,
    authenticate,
    requireOwnUser,
    validateUserIdParam,
    validateAvatarBody,
    avatarController.updateUserAvatar
);