/**
 * Avatar Controller
 *
 * Handles avatar-related operations.
 * Manages available avatars and user avatar assignments.
 */

import { Request, Response } from 'express';
import { QueryResult } from 'pg';
import { asyncHandler, authenticatedAsyncHandler } from '@middleware/errorHandler';
import { AuthenticatedRequest } from '@/types';
import { getPool } from '@utilities/database';

/**
 * Avatar interface matching the database schema
 */
interface Avatar {
    avatar_id: number;
    avatar_name: string;
    avatar_url: string;
    is_default?: boolean;
}

// ===================================================
// GET /avatar/all - Get all available avatars (PUBLIC)
// ===================================================
export const getAllAvatars = asyncHandler(
    async (request: Request, response: Response): Promise<void> => {
        const pool = getPool();
        const result: QueryResult<Avatar> = await pool.query(
            `SELECT avatar_id, avatar_name, avatar_url
             FROM avatars
             ORDER BY avatar_id`
        );

        response.status(200).json(result.rows);
    }
);

// ===================================================
// GET /:userid/avatar - Get user's current avatar
// ===================================================
export const getUserAvatar = authenticatedAsyncHandler(
    async (request: AuthenticatedRequest, response: Response): Promise<void> => {
        const userId = parseInt(request.params.userid || '', 10);

        const pool = getPool();

        // Try to get user's assigned avatar, or return default
        const result: QueryResult<Avatar> = await pool.query(
            `SELECT a.avatar_id, a.avatar_name, a.avatar_url
             FROM user_avatars ua
             JOIN avatars a ON ua.avatar_id = a.avatar_id
             WHERE ua.user_id = $1

             UNION ALL

             SELECT avatar_id, avatar_name, avatar_url
             FROM avatars
             WHERE is_default = TRUE
             AND NOT EXISTS (
                 SELECT 1 FROM user_avatars WHERE user_id = $1
             )
             LIMIT 1`,
            [userId]
        );

        if (result.rows.length === 0) {
            response.status(404).json({
                error: 'No avatar found for user',
                code: 'NOT_FOUND',
                timestamp: new Date().toISOString()
            });
            return;
        }

        response.status(200).json(result.rows[0]);
    }
);

// ===================================================
// PATCH /:userid/avatar - Update user's avatar
// ===================================================
export const updateUserAvatar = authenticatedAsyncHandler(
    async (request: AuthenticatedRequest, response: Response): Promise<void> => {
        const userId = parseInt(request.params.userid || '', 10);
        const { avatar_id } = request.body;

        const pool = getPool();

        // First, verify the avatar exists
        const avatarCheck: QueryResult<Avatar> = await pool.query(
            'SELECT avatar_id FROM avatars WHERE avatar_id = $1',
            [avatar_id]
        );

        if (avatarCheck.rows.length === 0) {
            response.status(404).json({
                error: 'Avatar not found',
                code: 'NOT_FOUND',
                timestamp: new Date().toISOString()
            });
            return;
        }

        // Update or insert user avatar assignment
        await pool.query(
            `INSERT INTO user_avatars (user_id, avatar_id)
             VALUES ($1, $2)
             ON CONFLICT (user_id)
             DO UPDATE SET
                 avatar_id = EXCLUDED.avatar_id,
                 updated_at = NOW()`,
            [userId, avatar_id]
        );

        // Fetch and return the full avatar details
        const result: QueryResult<Avatar> = await pool.query(
            `SELECT avatar_id, avatar_name, avatar_url
             FROM avatars
             WHERE avatar_id = $1`,
            [avatar_id]
        );

        response.status(200).json(result.rows[0]);
    }
);