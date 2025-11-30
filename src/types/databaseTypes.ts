/**
 * Database entity type definitions
 *
 * TypeScript interfaces matching the new unified database schema.
 * These types represent the actual structure of data in PostgreSQL tables.
 *
 * @see {@link ../../ai/implementation_guide.md} for schema documentation
 */

/**
 * Media type enumeration
 */
export type MediaType = 'movie' | 'tvshow';

/**
 * Source type for media items (used for API responses)
 */
export type SourceType = 'watchlist' | 'favorites' | 'watched';

/**
 * UserMedia entity - Unified table for watchlist, favorites, and watched content
 *
 * This table uses boolean flags to track which lists a media item belongs to,
 * allowing a single media item to exist in multiple lists (e.g., both watchlist and favorites).
 */
export interface UserMedia {
    /** UUID primary key */
    id: string;

    /** User ID (references external user system) */
    user_id: number;

    /** Media identifier (e.g., IMDB ID like 'tt1234567') */
    media_id: string;

    /** Type of media content */
    media_type: MediaType;

    /** Flag: Is this item in the user's watchlist? */
    is_watchlist: boolean;

    /** Flag: Is this item in the user's favorites? */
    is_favorite: boolean;

    /** Flag: Has the user watched this item? */
    is_watched: boolean;

    /** Timestamp when added to watchlist (null if not in watchlist) */
    watchlist_added_at: Date | null;

    /** Timestamp when added to favorites (null if not in favorites) */
    favorite_added_at: Date | null;

    /** Timestamp when marked as watched (null if not watched) */
    watched_at: Date | null;

    /** Record creation timestamp */
    created_at: Date;

    /** Record last update timestamp */
    updated_at: Date;
}

/**
 * Avatar entity - Available profile picture options
 *
 * Master table of all avatars that users can select from.
 */
export interface Avatar {
    /** Avatar identifier */
    avatar_id: number;

    /** Display name for the avatar */
    avatar_name: string;

    /** URL or path to the avatar image */
    avatar_url: string;

    /** Is this the default avatar for new users? */
    is_default: boolean;

    /** Avatar creation timestamp */
    created_at: Date;
}

/**
 * UserAvatar entity - User's selected avatar
 *
 * Links users to their chosen avatar from the avatars table.
 */
export interface UserAvatar {
    /** User ID (references external user system) */
    user_id: number;

    /** Selected avatar ID */
    avatar_id: number;

    /** When the user first set their avatar */
    created_at: Date;

    /** When the user last changed their avatar */
    updated_at: Date;

    /** Related avatar data (populated via JOIN) */
    avatar?: Avatar;
}

/**
 * Media item input for POST requests
 *
 * Request body structure for adding items to watchlist/favorites/watched.
 */
export interface MediaItemInput {
    /** Type of media content */
    media_type: MediaType;

    /** Media identifier (e.g., IMDB ID) */
    media_id: string;
}

/**
 * Media item response for API
 *
 * Response structure that matches the OpenAPI specification.
 * Maps database columns to API response fields.
 */
export interface MediaItemResponse {
    /** UUID of the record */
    id: string;

    /** Source category (watchlist, favorites, or watched) */
    source_text: SourceType;

    /** User ID who owns this entry */
    user_id: number;

    /** Type of media content */
    media_type: MediaType;

    /** Media identifier */
    media_id: string;

    /** When the item was added (timestamp varies by source) */
    added_at: string;
}

/**
 * Avatar update input for PATCH requests
 *
 * Request body structure for updating user's avatar.
 */
export interface AvatarUpdateInput {
    /** ID of the avatar to assign to the user */
    avatar_id: number;
}

/**
 * Avatar response for API
 *
 * Response structure that matches the OpenAPI specification.
 */
export interface AvatarResponse {
    /** Avatar identifier */
    avatar_id: number;

    /** Display name for the avatar */
    avatar_name: string;

    /** URL or path to the avatar image */
    avatar_url: string;
}