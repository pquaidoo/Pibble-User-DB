
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

### Step 4: Seed Avatar Data (Required)

Add the 7 predefined avatars (IDs 1-7) that users can choose from:

```sql
-- Insert 7 predefined avatars (avatar_id 1 is the default)
INSERT INTO avatars (avatar_name, avatar_url, is_default) VALUES
    ('Avatar 0 Smile', '/public/images/avatars/default/avatar0.png', TRUE),  -- ID 1 (default)
    ('Avatar 1 Bird', '/public/images/avatars/default/avatar1.png', FALSE),   -- ID 2
    ('Avatar 2 Girl', '/public/images/avatars/default/avatar2.png', FALSE),   -- ID 3
    ('Avatar 3 Dog', '/public/images/avatars/default/avatar3.png', FALSE),    -- ID 4
    ('Avatar 4 Rhino', '/public/images/avatars/default/avatar4.png', FALSE),  -- ID 5
    ('Avatar 5 Sheep', '/public/images/avatars/default/avatar5.png', FALSE),  -- ID 6
    ('Avatar 6 T-Rex', '/public/images/avatars/default/avatar6.png', FALSE);  -- ID 7

-- Verify avatars were inserted correctly
SELECT avatar_id, avatar_name, is_default FROM avatars ORDER BY avatar_id;
```

**Expected Result:**
```
 avatar_id |   avatar_name   | is_default
-----------+-----------------+------------
         1 | Avatar 0 Smile  | t
         2 | Avatar 1 Bird   | f
         3 | Avatar 2 Girl   | f
         4 | Avatar 3 Dog    | f
         5 | Avatar 4 Rhino  | f
         6 | Avatar 5 Sheep  | f
         7 | Avatar 6 T-Rex  | f
```

**Note:** Avatar ID 1 is marked as `is_default = TRUE` and will be automatically assigned to new users who haven't selected an avatar yet.

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

---

## Avatar Endpoints

The avatar system allows users to select from 7 predefined profile pictures (avatar_id 1-7).

### How It Works
1. **7 Predefined Avatars**: IDs 1-7 stored in `avatars` table
2. **Avatar #1 is Default**: Automatically assigned to new users
3. **User Selection**: Users can switch between avatars 1-7 via PATCH endpoint
4. **One Avatar Per User**: Stored in `user_avatars` table

---

#### 13. GET /avatar/all

**Purpose:** Get all available avatar options (IDs 1-7) to display in avatar picker UI

**Access:** Public (no authentication required)

**NEW QUERY:**
```sql
SELECT avatar_id, avatar_name, avatar_url, is_default
FROM avatars
ORDER BY avatar_id;
```

**Returns:** Array of 7 avatars
```json
[
  {
    "avatar_id": 1,
    "avatar_name": "Avatar 0 Smile",
    "avatar_url": "/public/images/avatars/default/avatar0.png",
    "is_default": true
  },
  {
    "avatar_id": 2,
    "avatar_name": "Avatar 1 Bird",
    "avatar_url": "/public/images/avatars/default/avatar1.png",
    "is_default": false
  },
  // ... avatars 3-7
]
```

---

#### 14. GET /:userid/avatar

**Purpose:** Get the user's currently selected avatar

**Access:** Authenticated (user can only access their own avatar)

**NEW QUERY (with default fallback):**
```sql
-- Try to get user's selected avatar, or return default if none selected
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

**Logic:**
- If user has selected an avatar → return their selected avatar
- If user has NOT selected an avatar → return default avatar (avatar_id = 1)

**Returns:** Single avatar object
```json
{
  "avatar_id": 3,
  "avatar_name": "Avatar 2 Girl",
  "avatar_url": "/public/images/avatars/default/avatar2.png"
}
```

---

#### 15. PATCH /:userid/avatar

**Purpose:** Update user's avatar selection (choose from avatars 1-7)

**Access:** Authenticated (user can only update their own avatar)

**Rate Limit:** 10 requests per hour (prevents abuse)

**Request Body:**
```json
{
  "avatar_id": 5
}
```

**Validation:**
- `avatar_id` must be a number between 1 and 7
- `avatar_id` must exist in `avatars` table
- Returns 400 error if validation fails

**NEW QUERY (Step 1 - Verify avatar exists):**
```sql
-- Verify the requested avatar exists
SELECT avatar_id FROM avatars WHERE avatar_id = $1;
-- If no rows returned, return 404 error
```

**NEW QUERY (Step 2 - Update user's avatar):**
```sql
-- Insert new avatar or update existing one
INSERT INTO user_avatars (user_id, avatar_id)
VALUES ($1, $2)
ON CONFLICT (user_id)
DO UPDATE SET
    avatar_id = EXCLUDED.avatar_id,
    updated_at = NOW()
RETURNING avatar_id;
```

**NEW QUERY (Step 3 - Return full avatar details):**
```sql
-- Fetch complete avatar information to return to client
SELECT a.avatar_id, a.avatar_name, a.avatar_url
FROM avatars a
WHERE a.avatar_id = $1;
```

**Returns:** Updated avatar object
```json
{
  "avatar_id": 5,
  "avatar_name": "Avatar 4 Rhino",
  "avatar_url": "/public/images/avatars/default/avatar4.png"
}
```

**Example Usage:**

**cURL:**
```bash
# Get all available avatars
curl http://localhost:8000/avatar/all

# Get user 123's current avatar
curl http://localhost:8000/123/avatar \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Update user 123's avatar to #5
curl -X PATCH http://localhost:8000/123/avatar \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"avatar_id": 5}'
```

**JavaScript:**
```javascript
// Get all available avatars
const avatars = await fetch('http://localhost:8000/avatar/all').then(r => r.json());

// Get user's current avatar
const currentAvatar = await fetch('http://localhost:8000/123/avatar', {
  headers: { 'Authorization': `Bearer ${token}` }
}).then(r => r.json());

// Update user's avatar to #5
const updatedAvatar = await fetch('http://localhost:8000/123/avatar', {
  method: 'PATCH',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ avatar_id: 5 })
}).then(r => r.json());
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
