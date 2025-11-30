/**
 * Database transaction utilities
 *
 * Helper functions for managing database transactions with proper error handling,
 * rollback on failure, and automatic connection cleanup.
 *
 * @see {@link ../../../ai/implementation_guide.md} for transaction usage examples
 */

import { PoolClient } from 'pg';
import { getPool } from './database';

/**
 * Execute a function within a database transaction
 *
 * Automatically handles BEGIN, COMMIT, ROLLBACK, and connection cleanup.
 * If the callback throws an error, the transaction is rolled back automatically.
 *
 * @template T The return type of the transaction callback
 * @param callback Function to execute within the transaction
 * @returns The result from the callback function
 * @throws Re-throws any error that occurs during the transaction
 *
 * @example
 * ```typescript
 * const result = await withTransaction(async (client) => {
 *   // First operation
 *   await client.query('UPDATE user_media SET is_watchlist = FALSE WHERE ...');
 *
 *   // Second operation
 *   await client.query('DELETE FROM user_media WHERE ...');
 *
 *   return { deleted: true };
 * });
 * ```
 */
export async function withTransaction<T>(
    callback: (client: PoolClient) => Promise<T>
): Promise<T> {
    const pool = getPool();
    const client = await pool.connect();

    try {
        // Begin transaction
        await client.query('BEGIN');

        // Execute callback with the client
        const result = await callback(client);

        // Commit transaction
        await client.query('COMMIT');

        return result;
    } catch (error) {
        // Rollback on error
        await client.query('ROLLBACK');
        throw error;
    } finally {
        // Always release the client back to the pool
        client.release();
    }
}

/**
 * Execute multiple queries within a transaction
 *
 * Simpler helper for executing a series of queries in a transaction
 * without needing to write the callback pattern.
 *
 * @param queries Array of query objects with text and params
 * @returns Array of query results in the same order
 *
 * @example
 * ```typescript
 * await executeInTransaction([
 *   {
 *     text: 'UPDATE user_media SET is_watchlist = FALSE WHERE user_id = $1',
 *     params: [userId]
 *   },
 *   {
 *     text: 'DELETE FROM user_media WHERE user_id = $1 AND is_watchlist = FALSE',
 *     params: [userId]
 *   }
 * ]);
 * ```
 */
export async function executeInTransaction(
    queries: Array<{ text: string; params?: any[] }>
): Promise<any[]> {
    return withTransaction(async (client) => {
        const results = [];

        for (const query of queries) {
            const result = await client.query(query.text, query.params || []);
            results.push(result);
        }

        return results;
    });
}