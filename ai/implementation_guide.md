
# Implementation Guide: New Database Schema

## Part 1: Database Setup

Since you don't have important data yet, you can simply drop the old tables and create the new ones.

### Step 1: Connect to Your Database Query Tool

Open your database query tool (pgAdmin, DBeaver, or psql command line) and connect to your database.

### Step 2: Drop Old Tables (If They Exist)

Run this first to clean up the old schema:

```sql
-- Drop old tables if they exist
DROP TABLE IF EXISTS watchlist CASCADE;
DROP TABLE IF EXISTS favorites CASCADE;
DROP TABLE IF EXISTS watched CASCADE;
```

### Step 3: Create New Tables

Copy and paste the entire schema from `recommended_schema.sql` or run these commands:

```sql
-- Avatars table (available profile pictures)
CREATE TABLE avatars (
    avatar_id SERIAL PRIMARY KEY,
    avatar_name VARCHAR(100) NOT NULL,
    avatar_url VARCHAR(500) NOT NULL,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- User avatars table (links external user_id to selected avatar)
CREATE TABLE user_avatars (
    user_id INTEGER PRIMARY KEY,
    avatar_id INTEGER NOT NULL REFERENCES avatars(avatar_id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- User media lists (watchlist, favorites, watched)
CREATE TABLE user_media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INTEGER NOT NULL,
    media_id VARCHAR(50) NOT NULL,
    media_type VARCHAR(20) NOT NULL CHECK (media_type IN ('movie', 'tvshow')),
    is_watchlist BOOLEAN DEFAULT FALSE,
    is_favorite BOOLEAN DEFAULT FALSE,
    is_watched BOOLEAN DEFAULT FALSE,
    watchlist_added_at TIMESTAMP WITH TIME ZONE,
    favorite_added_at TIMESTAMP WITH TIME ZONE,
    watched_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_user_media UNIQUE (user_id, media_id)
);

-- Create indexes
CREATE INDEX idx_user_media_user_id ON user_media(user_id);
CREATE INDEX idx_user_media_media_id ON user_media(media_id);
CREATE INDEX idx_user_media_media_type ON user_media(media_type);
CREATE INDEX idx_user_media_watchlist ON user_media(user_id) WHERE is_watchlist = TRUE;
CREATE INDEX idx_user_media_favorites ON user_media(user_id) WHERE is_favorite = TRUE;
CREATE INDEX idx_user_media_watched ON user_media(user_id) WHERE is_watched = TRUE;
CREATE INDEX idx_user_avatars_avatar_id ON user_avatars(avatar_id);

-- Create triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_avatars_updated_at
    BEFORE UPDATE ON user_avatars
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_media_updated_at
    BEFORE UPDATE ON user_media
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

### Step 4: Seed Avatar Data (Optional but Recommended)

Add some default avatars to choose from:

```sql
INSERT INTO avatars (avatar_name, avatar_url, is_default) VALUES
    ('Default Avatar', '/avatars/default.png', TRUE),
    ('Avatar 1', '/avatars/avatar1.png', FALSE),
    ('Avatar 2', '/avatars/avatar2.png', FALSE),
    ('Avatar 3', '/avatars/avatar3.png', FALSE),
    ('Avatar 4', '/avatars/avatar4.png', FALSE),
    ('Avatar 5', '/avatars/avatar5.png', FALSE);
```

### Step 5: Verify Tables Were Created

Run this to verify:

```sql
-- Check tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('user_media', 'avatars', 'user_avatars');

-- Check indexes
SELECT indexname 
FROM pg_indexes 
WHERE tablename IN ('user_media', 'user_avatars');
```

---

## Part 2: Update Your Web API

### Overview of Changes Needed

**Old API Structure (3 separate tables):**
- `/watchlist` → `watchlist` table
- `/favorites` → `favorites` table  
- `/watched` → `watched` table

**New API Structure (1 unified table):**
- All three lists → `user_media` table with boolean flags

---

### Query Changes by Endpoint

#### 1. GET /:userid/watchlist

**OLD QUERY:**
```sql
SELECT * FROM watchlist 
WHERE user_id = $1
ORDER BY added_at DESC;
```

**NEW QUERY:**
```sql
SELECT id, media_id, media_type, watchlist_added_at as added_at
FROM user_media 
WHERE user_id = $1 AND is_watchlist = TRUE
ORDER BY watchlist_added_at DESC;
```

---

#### 2. POST /:userid/watchlist

**OLD QUERY:**
```sql
INSERT INTO watchlist (user_id, media_id, media_type, added_at)
VALUES ($1, $2, $3, NOW())
RETURNING *;
```

**NEW QUERY:**
```sql
INSERT INTO user_media (user_id, media_id, media_type, is_watchlist, watchlist_added_at)
VALUES ($1, $2, $3, TRUE, NOW())
ON CONFLICT (user_id, media_id) 
DO UPDATE SET 
    is_watchlist = TRUE,
    watchlist_added_at = NOW()
RETURNING id, media_id, media_type, watchlist_added_at as added_at;
```

**Key Change:** Uses `ON CONFLICT` to handle case where media already exists for user.

---

#### 3. DELETE /:userid/watchlist/:mediaid

**OLD QUERY:**
```sql
DELETE FROM watchlist 
WHERE user_id = $1 AND media_id = $2;
```

**NEW QUERY (Option A - Remove flag only):**
```sql
UPDATE user_media
SET is_watchlist = FALSE,
    watchlist_added_at = NULL
WHERE user_id = $1 AND media_id = $2;
```

**NEW QUERY (Option B - Delete if no other flags):**
```sql
-- First, update the flag
UPDATE user_media
SET is_watchlist = FALSE,
    watchlist_added_at = NULL
WHERE user_id = $1 AND media_id = $2;

-- Then, delete if no other flags are set
DELETE FROM user_media
WHERE user_id = $1 
  AND media_id = $2
  AND is_watchlist = FALSE 
  AND is_favorite = FALSE 
  AND is_watched = FALSE;
```

**Recommendation:** Use Option B to keep the database clean.

---

#### 4. DELETE /:userid/watchlist (delete all)

**OLD QUERY:**
```sql
DELETE FROM watchlist 
WHERE user_id = $1;
```

**NEW QUERY (Option A - Remove flags only):**
```sql
UPDATE user_media
SET is_watchlist = FALSE,
    watchlist_added_at = NULL
WHERE user_id = $1 AND is_watchlist = TRUE;
```

**NEW QUERY (Option B - Delete if no other flags):**
```sql
-- First update
UPDATE user_media
SET is_watchlist = FALSE,
    watchlist_added_at = NULL
WHERE user_id = $1 AND is_watchlist = TRUE;

-- Then clean up
DELETE FROM user_media
WHERE user_id = $1
  AND is_watchlist = FALSE 
  AND is_favorite = FALSE 
  AND is_watched = FALSE;
```

---

#### 5-8. Favorites Endpoints (same pattern)

**GET /:userid/favorites:**
```sql
SELECT id, media_id, media_type, favorite_added_at as added_at
FROM user_media 
WHERE user_id = $1 AND is_favorite = TRUE
ORDER BY favorite_added_at DESC;
```

**POST /:userid/favorites:**
```sql
INSERT INTO user_media (user_id, media_id, media_type, is_favorite, favorite_added_at)
VALUES ($1, $2, $3, TRUE, NOW())
ON CONFLICT (user_id, media_id) 
DO UPDATE SET 
    is_favorite = TRUE,
    favorite_added_at = NOW()
RETURNING id, media_id, media_type, favorite_added_at as added_at;
```

**DELETE /:userid/favorites/:mediaid:**
```sql
-- Update flag
UPDATE user_media
SET is_favorite = FALSE,
    favorite_added_at = NULL
WHERE user_id = $1 AND media_id = $2;

-- Clean up if needed
DELETE FROM user_media
WHERE user_id = $1 
  AND media_id = $2
  AND is_watchlist = FALSE 
  AND is_favorite = FALSE 
  AND is_watched = FALSE;
```

**DELETE /:userid/favorites (all):**
```sql
-- Update flags
UPDATE user_media
SET is_favorite = FALSE,
    favorite_added_at = NULL
WHERE user_id = $1 AND is_favorite = TRUE;

-- Clean up
DELETE FROM user_media
WHERE user_id = $1
  AND is_watchlist = FALSE 
  AND is_favorite = FALSE 
  AND is_watched = FALSE;
```

---

#### 9-12. Watched Endpoints (same pattern)

**GET /:userid/watched:**
```sql
SELECT id, media_id, media_type, watched_at as added_at
FROM user_media 
WHERE user_id = $1 AND is_watched = TRUE
ORDER BY watched_at DESC;
```

**POST /:userid/watched:**
```sql
INSERT INTO user_media (user_id, media_id, media_type, is_watched, watched_at)
VALUES ($1, $2, $3, TRUE, NOW())
ON CONFLICT (user_id, media_id) 
DO UPDATE SET 
    is_watched = TRUE,
    watched_at = NOW()
RETURNING id, media_id, media_type, watched_at as added_at;
```

**DELETE /:userid/watched/:mediaid:**
```sql
UPDATE user_media
SET is_watched = FALSE,
    watched_at = NULL
WHERE user_id = $1 AND media_id = $2;

DELETE FROM user_media
WHERE user_id = $1 
  AND media_id = $2
  AND is_watchlist = FALSE 
  AND is_favorite = FALSE 
  AND is_watched = FALSE;
```

**DELETE /:userid/watched (all):**
```sql
UPDATE user_media
SET is_watched = FALSE,
    watched_at = NULL
WHERE user_id = $1 AND is_watched = TRUE;

DELETE FROM user_media
WHERE user_id = $1
  AND is_watchlist = FALSE 
  AND is_favorite = FALSE 
  AND is_watched = FALSE;
```

---

#### 13. GET /avatar/all

**NEW QUERY:**
```sql
SELECT avatar_id, avatar_name, avatar_url, is_default
FROM avatars
ORDER BY avatar_id;
```

---

#### 14. GET /:userid/avatar

**NEW QUERY:**
```sql
SELECT a.avatar_id, a.avatar_name, a.avatar_url
FROM user_avatars ua
JOIN avatars a ON ua.avatar_id = a.avatar_id
WHERE ua.user_id = $1;
```

**If user hasn't set an avatar yet, return the default:**
```sql
SELECT a.avatar_id, a.avatar_name, a.avatar_url
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
LIMIT 1;
```

---

#### 15. PATCH /:userid/avatar

**NEW QUERY:**
```sql
INSERT INTO user_avatars (user_id, avatar_id)
VALUES ($1, $2)
ON CONFLICT (user_id)
DO UPDATE SET 
    avatar_id = EXCLUDED.avatar_id,
    updated_at = NOW()
RETURNING avatar_id;
```

Then fetch the full avatar details:
```sql
SELECT a.avatar_id, a.avatar_name, a.avatar_url
FROM avatars a
WHERE a.avatar_id = $1;
```

---

## Part 3: Example Code Changes

### If Using Node.js with pg (PostgreSQL)

**OLD CODE (for watchlist GET):**
```javascript
app.get('/:userid/watchlist', async (req, res) => {
    const { userid } = req.params;
    
    const result = await pool.query(
        'SELECT * FROM watchlist WHERE user_id = $1 ORDER BY added_at DESC',
        [userid]
    );
    
    res.json(result.rows);
});
```

**NEW CODE (for watchlist GET):**
```javascript
app.get('/:userid/watchlist', async (req, res) => {
    const { userid } = req.params;
    
    const result = await pool.query(
        `SELECT id, media_id, media_type, watchlist_added_at as added_at
         FROM user_media 
         WHERE user_id = $1 AND is_watchlist = TRUE
         ORDER BY watchlist_added_at DESC`,
        [userid]
    );
    
    res.json(result.rows);
});
```

**OLD CODE (for watchlist POST):**
```javascript
app.post('/:userid/watchlist', async (req, res) => {
    const { userid } = req.params;
    const { media_id, media_type } = req.body;
    
    const result = await pool.query(
        `INSERT INTO watchlist (user_id, media_id, media_type, added_at)
         VALUES ($1, $2, $3, NOW())
         RETURNING *`,
        [userid, media_id, media_type]
    );
    
    res.status(201).json(result.rows[0]);
});
```

**NEW CODE (for watchlist POST):**
```javascript
app.post('/:userid/watchlist', async (req, res) => {
    const { userid } = req.params;
    const { media_id, media_type } = req.body;
    
    const result = await pool.query(
        `INSERT INTO user_media (user_id, media_id, media_type, is_watchlist, watchlist_added_at)
         VALUES ($1, $2, $3, TRUE, NOW())
         ON CONFLICT (user_id, media_id) 
         DO UPDATE SET 
             is_watchlist = TRUE,
             watchlist_added_at = NOW()
         RETURNING id, media_id, media_type, watchlist_added_at as added_at`,
        [userid, media_id, media_type]
    );
    
    res.status(201).json(result.rows[0]);
});
```

**OLD CODE (for watchlist DELETE single):**
```javascript
app.delete('/:userid/watchlist/:mediaid', async (req, res) => {
    const { userid, mediaid } = req.params;
    
    await pool.query(
        'DELETE FROM watchlist WHERE user_id = $1 AND media_id = $2',
        [userid, mediaid]
    );
    
    res.status(204).send();
});
```

**NEW CODE (for watchlist DELETE single):**
```javascript
app.delete('/:userid/watchlist/:mediaid', async (req, res) => {
    const { userid, mediaid } = req.params;
    
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // Remove watchlist flag
        await client.query(
            `UPDATE user_media
             SET is_watchlist = FALSE, watchlist_added_at = NULL
             WHERE user_id = $1 AND media_id = $2`,
            [userid, mediaid]
        );
        
        // Clean up if no other flags
        await client.query(
            `DELETE FROM user_media
             WHERE user_id = $1 AND media_id = $2
             AND is_watchlist = FALSE 
             AND is_favorite = FALSE 
             AND is_watched = FALSE`,
            [userid, mediaid]
        );
        
        await client.query('COMMIT');
        res.status(204).send();
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
});
```

---

### If Using C# with Entity Framework or Dapper

**Entity Model (OLD - 3 separate classes):**
```csharp
public class Watchlist
{
    public Guid Id { get; set; }
    public int UserId { get; set; }
    public string MediaId { get; set; }
    public string MediaType { get; set; }
    public DateTime AddedAt { get; set; }
}
// Similar for Favorites and Watched
```

**Entity Model (NEW - 1 unified class):**
```csharp
public class UserMedia
{
    public Guid Id { get; set; }
    public int UserId { get; set; }
    public string MediaId { get; set; }
    public string MediaType { get; set; }
    
    public bool IsWatchlist { get; set; }
    public bool IsFavorite { get; set; }
    public bool IsWatched { get; set; }
    
    public DateTime? WatchlistAddedAt { get; set; }
    public DateTime? FavoriteAddedAt { get; set; }
    public DateTime? WatchedAt { get; set; }
    
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class Avatar
{
    public int AvatarId { get; set; }
    public string AvatarName { get; set; }
    public string AvatarUrl { get; set; }
    public bool IsDefault { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class UserAvatar
{
    public int UserId { get; set; }
    public int AvatarId { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    
    public Avatar Avatar { get; set; }
}
```

**Dapper Query Example (OLD):**
```csharp
var watchlist = await connection.QueryAsync<Watchlist>(
    "SELECT * FROM watchlist WHERE user_id = @UserId ORDER BY added_at DESC",
    new { UserId = userId }
);
```

**Dapper Query Example (NEW):**
```csharp
var watchlist = await connection.QueryAsync<UserMedia>(
    @"SELECT id, media_id, media_type, watchlist_added_at as added_at
      FROM user_media 
      WHERE user_id = @UserId AND is_watchlist = TRUE
      ORDER BY watchlist_added_at DESC",
    new { UserId = userId }
);
```

---

## Part 4: Testing Your Implementation

### Test 1: Add to Watchlist
```sql
-- Add a movie to watchlist
INSERT INTO user_media (user_id, media_id, media_type, is_watchlist, watchlist_added_at)
VALUES (456, 'tt1234567', 'movie', TRUE, NOW())
ON CONFLICT (user_id, media_id) 
DO UPDATE SET is_watchlist = TRUE, watchlist_added_at = NOW();

-- Verify
SELECT * FROM user_media WHERE user_id = 456;
```

### Test 2: Add Same Movie to Favorites
```sql
-- Add same movie to favorites (should update existing row)
INSERT INTO user_media (user_id, media_id, media_type, is_favorite, favorite_added_at)
VALUES (456, 'tt1234567', 'movie', TRUE, NOW())
ON CONFLICT (user_id, media_id) 
DO UPDATE SET is_favorite = TRUE, favorite_added_at = NOW();

-- Verify - should see ONE row with both flags
SELECT * FROM user_media WHERE user_id = 456;
-- Expected: is_watchlist = TRUE, is_favorite = TRUE
```

### Test 3: Get Watchlist
```sql
SELECT media_id, media_type, watchlist_added_at 
FROM user_media 
WHERE user_id = 456 AND is_watchlist = TRUE;
```

### Test 4: Remove from Watchlist (but keep in favorites)
```sql
UPDATE user_media
SET is_watchlist = FALSE, watchlist_added_at = NULL
WHERE user_id = 456 AND media_id = 'tt1234567';

-- Verify - row should still exist with is_favorite = TRUE
SELECT * FROM user_media WHERE user_id = 456;
```

### Test 5: Avatar Operations
```sql
-- Get all avatars
SELECT * FROM avatars;

-- Assign avatar to user
INSERT INTO user_avatars (user_id, avatar_id)
VALUES (456, 2)
ON CONFLICT (user_id)
DO UPDATE SET avatar_id = EXCLUDED.avatar_id;

-- Get user's avatar
SELECT a.* FROM user_avatars ua
JOIN avatars a ON ua.avatar_id = a.avatar_id
WHERE ua.user_id = 456;
```

---

## Summary Checklist

- [ ] Run DROP TABLE commands to remove old tables
- [ ] Run CREATE TABLE commands to create new schema
- [ ] Insert seed avatar data
- [ ] Verify tables created with SELECT query
- [ ] Update all GET endpoints to query user_media with appropriate flags
- [ ] Update all POST endpoints to use INSERT ... ON CONFLICT
- [ ] Update all DELETE endpoints to use UPDATE + DELETE pattern
- [ ] Add new avatar endpoints (GET all, GET user, PATCH user)
- [ ] Test each endpoint with sample data
- [ ] Update your API documentation/Swagger file

---

## Common Pitfalls to Avoid

1. **Forgetting ON CONFLICT:** Always use `ON CONFLICT` in POST endpoints to handle cases where the media already exists
2. **Not cleaning up:** When removing flags, delete the row if no flags remain
3. **Wrong column names:** Make sure to map `watchlist_added_at` to `added_at` in your response
4. **Missing transactions:** Use transactions for DELETE operations that have multiple steps
5. **NULL timestamps:** Remember that timestamp columns can be NULL when flags are FALSE

Good luck with your implementation!
