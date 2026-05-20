import sqlite3
from contextlib import contextmanager
from typing import Iterator

from app.config import settings


SCHEMA = """
CREATE TABLE IF NOT EXISTS pdfs (
    id              TEXT PRIMARY KEY,
    filename        TEXT NOT NULL,
    file_hash       TEXT NOT NULL UNIQUE,
    file_path       TEXT NOT NULL,
    collection_name TEXT NOT NULL,
    status          TEXT NOT NULL,           -- 'indexing' | 'ready' | 'failed'
    chunk_count     INTEGER NOT NULL DEFAULT 0,
    progress        INTEGER NOT NULL DEFAULT 0,  -- 0..100, only meaningful while 'indexing'
    error_message   TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS messages (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    pdf_id     TEXT NOT NULL REFERENCES pdfs(id) ON DELETE CASCADE,
    role       TEXT NOT NULL,                -- 'user' | 'assistant'
    content    TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_messages_pdf ON messages(pdf_id, id);
"""


def init_db() -> None:
    """Create tables on startup. Idempotent. Also runs lightweight migrations
    so existing dev DBs pick up new columns without manual intervention."""
    with connect() as conn:
        conn.executescript(SCHEMA)
        # Migration: add `progress` to older DBs created before the column existed.
        cols = {row["name"] for row in conn.execute("PRAGMA table_info(pdfs)").fetchall()}
        if "progress" not in cols:
            conn.execute("ALTER TABLE pdfs ADD COLUMN progress INTEGER NOT NULL DEFAULT 0")


@contextmanager
def connect() -> Iterator[sqlite3.Connection]:
    """Yields a sqlite connection with FK enforcement and dict-like rows."""
    conn = sqlite3.connect(settings.db_path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()
