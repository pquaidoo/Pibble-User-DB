/**
 * Main application routing configuration
 *
 * Configures all API routes with proper organization, middleware application,
 * and error handling for a complete routing system.
 *
 * @see {@link ../../docs/node-express-architecture.md#routing-architecture} for routing patterns
 */

import { Router } from 'express';
import { healthRoutes } from './open/healthRoutes';
import { watchlistRoutes } from './open/watchlistRoutes';
import { favoritesRoutes } from './open/favoritesRoutes';
import { watchedRoutes } from './open/watchedRoutes';
import { avatarRoutes } from './open/avatarRoutes';
import docsRoutes from './open/docsRoutes';
import { notFoundHandler } from '@middleware/errorHandler';

export const routes = Router();

// Health check routes (no authentication required)
routes.use('/health', healthRoutes);

// Documentation routes (no authentication required)
routes.use('/docs', docsRoutes);

// User media routes (authentication required)
// Note: These routes follow the pattern /:userid/resource
routes.use('/', watchlistRoutes);
routes.use('/', favoritesRoutes);
routes.use('/', watchedRoutes);

// Avatar routes (mixed - /avatar/all is public, /:userid/avatar requires auth)
routes.use('/', avatarRoutes);

// API version and documentation endpoint
routes.get('/', (request, response) => {
    response.json({
        success: true,
        message: 'Media Tracking API',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        endpoints: {
            // Health and docs
            health: '/health',
            healthDetailed: '/health/detailed',
            docs: '/docs',

            // Watchlist operations
            getWatchlist: 'GET /:userid/watchlist',
            addToWatchlist: 'POST /:userid/watchlist',
            deleteWatchlistItem: 'DELETE /:userid/watchlist/:mediaid',
            deleteAllWatchlist: 'DELETE /:userid/watchlist',

            // Favorites operations
            getFavorites: 'GET /:userid/favorites',
            addToFavorites: 'POST /:userid/favorites',
            deleteFavoriteItem: 'DELETE /:userid/favorites/:mediaid',
            deleteAllFavorites: 'DELETE /:userid/favorites',

            // Watched operations
            getWatched: 'GET /:userid/watched',
            addToWatched: 'POST /:userid/watched',
            deleteWatchedItem: 'DELETE /:userid/watched/:mediaid',
            deleteAllWatched: 'DELETE /:userid/watched',

            // Avatar operations
            getAllAvatars: 'GET /avatar/all',
            getUserAvatar: 'GET /:userid/avatar',
            updateUserAvatar: 'PATCH /:userid/avatar'
        },
        documentation: '/api-docs'
    });
});

// Handle 404 for unmatched routes
routes.use('*', notFoundHandler);