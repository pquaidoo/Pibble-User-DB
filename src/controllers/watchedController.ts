/**
 * Watched Controller
 *
 * Handles all watched history operations for users.
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
    watched_at: Date | null;
    added_at?: Date; // Alias from SQL query
}

/**
 * Response format for watched items
 */
interface WatchedResponse {
    id: string;
    source_text: 'watched';
    user_id: number;
    media_type: 'movie' | 'tvshow';
    media_id: string;
    added_at: Date;
}

// ===================================================
// GET /:userid/watched - Get all watched items
// ===================================================
export const getWatched = authenticatedAsyncHandler(
    async (request: AuthenticatedRequest, response: Response): Promise<void> => {
        const userId = parseInt(request.params.userid || '', 10);

        const pool = getPool();
        const result: QueryResult<UserMedia> = await pool.query(
            `SELECT id, user_id, media_id, media_type,
                    watched_at as added_at
             FROM user_media
             WHERE user_id = $1 AND is_watched = TRUE
             ORDER BY watched_at DESC`,
            [userId]
        );

        const watchedItems: WatchedResponse[] = result.rows.map(row => ({
            id: row.id,
            source_text: 'watched',
            user_id: row.user_id,
            media_type: row.media_type,
            media_id: row.media_id,
            added_at: row.added_at as unknown as Date
        }));

        response.status(200).json(watchedItems);
    }
);

// ===================================================
// POST /:userid/watched - Add item to watched
// ===================================================
export const addToWatched = authenticatedAsyncHandler(
    async (request: AuthenticatedRequest, response: Response): Promise<void> => {
        const userId = parseInt(request.params.userid || '', 10);
        const { media_id, media_type } = request.body;

        const pool = getPool();
        const result: QueryResult<UserMedia> = await pool.query(
            `INSERT INTO user_media (user_id, media_id, media_type, is_watched, watched_at)
             VALUES ($1, $2, $3, TRUE, NOW())
             ON CONFLICT (user_id, media_id)
             DO UPDATE SET
                 is_watched = TRUE,
                 watched_at = NOW()
             RETURNING id, user_id, media_id, media_type, watched_at as added_at`,
            [userId, media_id, media_type]
        );

        if (!result.rows[0]) {
            response.status(500).json({
                error: 'Failed to add item to watched',
                code: 'INTERNAL_ERROR',
                timestamp: new Date().toISOString()
            });
            return;
        }

        const addedItem = result.rows[0];
        const watchedItem: WatchedResponse = {
            id: addedItem.id,
            source_text: 'watched',
            user_id: addedItem.user_id,
            media_type: addedItem.media_type,
            media_id: addedItem.media_id,
            added_at: addedItem.added_at!
        };

        response.status(201).json(watchedItem);
    }
);

// ===================================================
// DELETE /:userid/watched/:mediaid - Delete single item
// ===================================================
export const deleteWatchedItem = authenticatedAsyncHandler(
    async (request: AuthenticatedRequest, response: Response): Promise<void> => {
        const userId = parseInt(request.params.userid || '', 10);
        const mediaId = request.params.mediaid;

        await withTransaction(async (client: PoolClient) => {
            // Remove the watched flag
            await client.query(
                `UPDATE user_media
                 SET is_watched = FALSE,
                     watched_at = NULL
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
// DELETE /:userid/watched - Delete all watched items
// ===================================================
export const deleteAllWatched = authenticatedAsyncHandler(
    async (request: AuthenticatedRequest, response: Response): Promise<void> => {
        const userId = parseInt(request.params.userid || '', 10);

        await withTransaction(async (client: PoolClient) => {
            // Remove all watched flags
            await client.query(
                `UPDATE user_media
                 SET is_watched = FALSE,
                     watched_at = NULL
                 WHERE user_id = $1 AND is_watched = TRUE`,
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