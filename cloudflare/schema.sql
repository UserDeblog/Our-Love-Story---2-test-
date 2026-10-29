CREATE TABLE IF NOT EXISTS memories (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL DEFAULT '',
    subtitle TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL CHECK (category IN ('us', 'dates', 'special-days', 'videos')),
    media_type TEXT NOT NULL CHECK (media_type IN ('image', 'video')),
    file_key TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS memories_created_at_idx ON memories(created_at);
