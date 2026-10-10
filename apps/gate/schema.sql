-- The whole database: who asked to be told, and when. Nothing else is stored.
CREATE TABLE IF NOT EXISTS waitlist (
  email TEXT PRIMARY KEY,
  joined_at TEXT NOT NULL
);
