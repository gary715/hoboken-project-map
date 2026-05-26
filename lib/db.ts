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

export default db;
