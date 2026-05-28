import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const dataDir = path.join(process.cwd(), "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, "projects.db"));

db.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    address     TEXT    NOT NULL,
    project_type TEXT,
    completed_date TEXT,
    lat         REAL,
    lng         REAL,
    geocoded    INTEGER DEFAULT 0,
    notes       TEXT,
    created_at  TEXT    DEFAULT (datetime('now'))
  )
`);

// Migration: store a manually-corrected building footprint (GeoJSON polygon)
const cols = db.prepare("PRAGMA table_info(projects)").all() as {
  name: string;
}[];
if (!cols.some((c) => c.name === "footprint")) {
  db.exec("ALTER TABLE projects ADD COLUMN footprint TEXT");
}

// Published snapshot: the public/website map reads ONLY from this table.
// Admin edits live in `projects` (draft) and are copied here on "Publish".
db.exec(`
  CREATE TABLE IF NOT EXISTS published_projects (
    id             INTEGER PRIMARY KEY,
    address        TEXT NOT NULL,
    project_type   TEXT,
    completed_date TEXT,
    lat            REAL,
    lng            REAL,
    notes          TEXT,
    footprint      TEXT
  )
`);

export default db;
