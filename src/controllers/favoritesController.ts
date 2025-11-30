/**
 * Favorites Controller
 *
 * Handles all favorites-related operations for users.
 * Uses the new user_media table schema with boolean flags.
 */

import { Response } from 'express';
import { QueryResult } from 'pg';
import { authenticatedAsyncHandler } from '@middleware/errorHandler';
import { AuthenticatedRequest } from '@/types';
import { getPool } from '@utilities/database';
import { withTransaction } from '@utilities/transactionUtils';
import { PoolClient } from 'pg';

/**
 * Media item interface matching the database schema
 */
interface UserMedia {
    id: string;
    user_id: number;
    media_type: 'movie' | 'tvshow';
    media_id: string;
    is_watchlist: boolean;
    is_favorite: boolean;
    is_watched: boolean;
    favorite_added_at: Date | null;
    added_at?: Date; // Alias from SQL query
}

/**
 * Response format for favorite items
 */
interface FavoriteResponse {
    id: string;
    source_text: 'favorites';
    user_id: number;
    media_type: 'movie' | 'tvshow';
    media_id: string;
    added_at: Date;
}

// ===================================================
// GET /:userid/favorites - Get all favorite items
// ===================================================
export const getFavorites = authenticatedAsyncHandler(
    async (request: AuthenticatedRequest, response: Response): Promise<void> => {
        const userId = parseInt(request.params.userid || '', 10);

        const pool = getPool();
        const result: QueryResult<UserMedia> = await pool.query(
            `SELECT id, user_id, media_id, media_type,
                    favorite_added_at as added_at
             FROM user_media
             WHERE user_id = $1 AND is_favorite = TRUE
             ORDER BY favorite_added_at DESC`,
            [userId]
        );

        const favoriteItems: FavoriteResponse[] = result.rows.map(row => ({
            id: row.id,
            source_text: 'favorites',
            user_id: row.user_id,
            media_type: row.media_type,
            media_id: row.media_id,
            added_at: row.added_at as unknown as Date
        }));

        response.status(200).json(favoriteItems);
    }
);

// ===================================================
// POST /:userid/favorites - Add item to favorites
// ===================================================
export const addToFavorites = authenticatedAsyncHandler(
    async (request: AuthenticatedRequest, response: Response): Promise<void> => {
        const userId = parseInt(request.params.userid || '', 10);
        const { media_id, media_type } = request.body;

        const pool = getPool();
        const result: QueryResult<UserMedia> = await pool.query(
            `INSERT INTO user_media (user_id, media_id, media_type, is_favorite, favorite_added_at)
             VALUES ($1, $2, $3, TRUE, NOW())
             ON CONFLICT (user_id, media_id)
             DO UPDATE SET
                 is_favorite = TRUE,
                 favorite_added_at = NOW()
             RETURNING id, user_id, media_id, media_type, favorite_added_at as added_at`,
            [userId, media_id, media_type]
        );

        if (!result.rows[0]) {
            response.status(500).json({
                error: 'Failed to add item to favorites',
                code: 'INTERNAL_ERROR',
                timestamp: new Date().toISOString()
            });
            return;
        }

        const addedItem = result.rows[0];
        const favoriteItem: FavoriteResponse = {
            id: addedItem.id,
            source_text: 'favorites',
            user_id: addedItem.user_id,
            media_type: addedItem.media_type,
            media_id: addedItem.media_id,
            added_at: addedItem.added_at!
        };

        response.status(201).json(favoriteItem);
    }
);

// ===================================================
// DELETE /:userid/favorites/:mediaid - Delete single item
// ===================================================
export const deleteFavoriteItem = authenticatedAsyncHandler(
    async (request: AuthenticatedRequest, response: Response): Promise<void> => {
        const userId = parseInt(request.params.userid || '', 10);
        const mediaId = request.params.mediaid;

        await withTransaction(async (client: PoolClient) => {
            // Remove the favorite flag
            await client.query(
                `UPDATE user_media
                 SET is_favorite = FALSE,
                     favorite_added_at = NULL
                 WHERE user_id = $1 AND media_id = $2`,
                [userId, mediaId]
            );

            // Delete the row if no other flags are set
            await client.query(
                `DELETE FROM user_media
                 WHERE user_id = $1
                   AND media_id = $2
                   AND is_watchlist = FALSE
                   AND is_favorite = FALSE
                   AND is_watched = FALSE`,
                [userId, mediaId]
            );
        });

        response.status(204).send();
    }
);

// ===================================================
// DELETE /:userid/favorites - Delete all favorite items
// ===================================================
export const deleteAllFavorites = authenticatedAsyncHandler(
    async (request: AuthenticatedRequest, response: Response): Promise<void> => {
        const userId = parseInt(request.params.userid || '', 10);

        await withTransaction(async (client: PoolClient) => {
            // Remove all favorite flags
            await client.query(
                `UPDATE user_media
                 SET is_favorite = FALSE,
                     favorite_added_at = NULL
                 WHERE user_id = $1 AND is_favorite = TRUE`,
                [userId]
            );

            // Clean up rows with no flags
            await client.query(
                `DELETE FROM user_media
                 WHERE user_id = $1
                   AND is_watchlist = FALSE
                   AND is_favorite = FALSE
                   AND is_watched = FALSE`,
                [userId]
            );
        });

        response.status(204).send();
    }
);