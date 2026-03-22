-- Users table - stores user profiles
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,                    -- Google user ID
    email TEXT UNIQUE NOT NULL,             -- Email address
    name TEXT NOT NULL,                     -- Display name
    picture TEXT,                           -- Profile picture URL
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- User settings table
CREATE TABLE IF NOT EXISTS user_settings (
    user_id TEXT PRIMARY KEY,               -- Link to users.id
    api_key TEXT,                           -- remove.bg API key (encrypted)
    default_output_format TEXT DEFAULT 'png', -- png, jpg, webp
    default_size TEXT DEFAULT 'auto',       -- auto, preview, full
    notify_on_completion INTEGER DEFAULT 1, -- 0 or 1
    theme TEXT DEFAULT 'light',             -- light, dark
    language TEXT DEFAULT 'zh-CN',          -- zh-CN, en, etc.
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Processing history table
CREATE TABLE IF NOT EXISTS processing_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,                  -- Link to users.id
    original_url TEXT,                      -- Original image URL
    result_url TEXT,                        -- Processed image URL
    file_size INTEGER,                      -- File size in bytes
    status TEXT DEFAULT 'success',          -- success, failed
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- User statistics table
CREATE TABLE IF NOT EXISTS user_stats (
    user_id TEXT PRIMARY KEY,               -- Link to users.id
    total_processed INTEGER DEFAULT 0,      -- Total images processed
    total_storage_mb REAL DEFAULT 0,        -- Total storage used in MB
    last_processed_at DATETIME,             -- Last processing time
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_history_user_time ON processing_history(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_history_status ON processing_history(status);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);