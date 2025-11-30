/**
 * Open routes barrel exports
 *
 * Aggregates all publicly accessible routes.
 * Note: Most routes require authentication, but are organized here for clarity.
 *
 * @see {@link ../../../docs/node-express-architecture.md#routing-patterns} for routing organization
 */

// Health monitoring routes
export * from './healthRoutes';

// User media routes
export * from './watchlistRoutes';
export * from './favoritesRoutes';
export * from './watchedRoutes';

// Avatar routes
export * from './avatarRoutes';
