
/**
 * Database connection pool management for PostgreSQL
 *
 * Provides a singleton connection pool pattern for efficient database access
 * across the entire application. Manages connection lifecycle from startup
 * through graceful shutdown.
 *
 * @see {@link ../../../docs/environment-configuration.md} for database configuration
 */

import { Pool } from 'pg';

/**
 * Singleton pool instance
 *
 * Shared across the entire application to reuse database connections efficiently.
 * Null until connectToDatabase() is called during application startup.
 */
let pool: Pool | null = null;

/**
 * Initialize database connection pool
 *
 * Creates a singleton pool instance and tests the connection.
 * Should be called once during application startup.
 *
 * @throws Error if connection fails or pool already exists
 * @example
 * ```typescript
 * // In src/index.ts
 * await connectToDatabase();
 * console.log('✅ Connected to database');
 * ```
 */
export const connectToDatabase = async (): Promise<void> => {
    // Prevent multiple connection attempts
    if (pool) {
        console.warn('⚠️  Database pool already exists. Skipping connection.');
        return;
    }

    try {
        // Create the connection pool with Supabase configuration
        pool = new Pool({
            // connectionString: gets the database URL from .env file
            // Format: postgresql://username:password@host:port/database
            connectionString: process.env.DATABASE_URL,

            // ssl: required for Supabase cloud databases
            // rejectUnauthorized: false allows self-signed certificates
            // (needed for secure connection to Supabase)
            ssl: { rejectUnauthorized: false },

            // Connection pool settings for Supabase pooler
            max: 20,                        // Maximum number of clients in the pool
            idleTimeoutMillis: 30000,       // Close idle connections after 30 seconds
            connectionTimeoutMillis: 10000, // Return error after 10 seconds if connection can't be established
            allowExitOnIdle: true           // Allow the pool to close all idle clients when there are no active queries
        });

        // Test the connection by acquiring and releasing a client
        const client = await pool.connect();
        console.log('✅ Database connection test successful');
        client.release();

        // Log success
        console.log('✅ Connected to Supabase PostgreSQL database');

        // Setup error handlers for the pool
        pool.on('error', (err) => {
            console.error('❌ Unexpected error on idle database client:', err);
            process.exit(-1);
        });

    } catch (error) {
        console.error('❌ Failed to connect to database:', error);
        throw error;
    }
};

/**
 * Get the database connection pool
 *
 * Returns the singleton pool instance for executing queries.
 * Use this in all controllers and services that need database access.
 *
 * @returns PostgreSQL pool instance
 * @throws Error if pool has not been initialized
 * @example
 * ```typescript
 * // In a controller
 * const pool = getPool();
 * const result = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
 * ```
 */
export const getPool = (): Pool => {
    if (!pool) {
        throw new Error(
            'Database pool not initialized. Call connectToDatabase() first.'
        );
    }
    return pool;
};

/**
 * Close all database connections gracefully
 *
 * Ends the pool and closes all active connections.
 * Should be called during application shutdown.
 *
 * @example
 * ```typescript
 * // In graceful shutdown handler
 * process.on('SIGTERM', async () => {
 *   await disconnectFromDatabase();
 *   process.exit(0);
 * });
 * ```
 */
export const disconnectFromDatabase = async (): Promise<void> => {
    if (pool) {
        try {
            await pool.end();
            console.log('✅ Database connections closed gracefully');
            pool = null;
        } catch (error) {
            console.error('❌ Error closing database connections:', error);
            throw error;
        }
    }
};

/**
 * Get current pool status information
 *
 * Useful for monitoring and debugging connection pool health.
 *
 * @returns Pool statistics object
 */
export const getPoolStatus = () => {
    if (!pool) {
        return { connected: false };
    }

    return {
        connected: true,
        totalCount: pool.totalCount,      // Total number of clients in the pool
        idleCount: pool.idleCount,        // Number of idle clients
        waitingCount: pool.waitingCount,  // Number of queued requests waiting for a client
    };
};