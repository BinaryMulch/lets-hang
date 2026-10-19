import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

// DB lives in ./data relative to the working directory. In production
// (standalone or Docker) set DB_PATH to an absolute path. For Coolify,
// mount a persistent volume on the directory that DB_PATH points into.
const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), "data", "app.db");

const globalForDb = globalThis as unknown as { __hangDb?: Database.Database };

export function getDb(): Database.Database {
  if (!globalForDb.__hangDb) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    const db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    db.exec(`
      CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        picked_date TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS participants (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        secret TEXT NOT NULL DEFAULT '',
        color TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_participants_event_name
        ON participants(event_id, name COLLATE NOCASE);

      CREATE TABLE IF NOT EXISTS slots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        participant_id INTEGER NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
        date TEXT NOT NULL,
        UNIQUE(participant_id, date)
      );

      CREATE INDEX IF NOT EXISTS idx_slots_date ON slots(date);
    `);

    // Identity upgrade migration: per-person edit secrets + avatar colors.
    const participantCols = db.prepare("PRAGMA table_info(participants)").all() as { name: string }[];
    if (!participantCols.find((c) => c.name === "secret")) {
      db.exec("ALTER TABLE participants ADD COLUMN secret TEXT NOT NULL DEFAULT ''");
    }
    if (!participantCols.find((c) => c.name === "color")) {
      db.exec("ALTER TABLE participants ADD COLUMN color TEXT NOT NULL DEFAULT ''");
    }

    globalForDb.__hangDb = db;
  }
  return globalForDb.__hangDb;
}

export type EventRow = {
  id: number;
  code: string;
  title: string;
  start_date: string; // YYYY-MM-DD inclusive
  end_date: string; // YYYY-MM-DD inclusive
  picked_date: string | null;
  created_at: string;
};

export type ParticipantRow = {
  id: number;
  event_id: number;
  name: string;
  secret: string; // per-person edit credential; NEVER sent to read endpoints
  color: string; // avatar color key from lib/avatars.ts palette
  created_at: string;
};

export type SlotRow = {
  id: number;
  participant_id: number;
  date: string;
};