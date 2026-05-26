/* eslint-disable no-console */
import path from "path";
import * as XLSX from "xlsx";
import db from "../lib/db";
import { geocodeAddress } from "../lib/geocode";

const FILE =
  process.argv[2] ||
  "/Users/Gary/Downloads/Hoboken completed full roof jobs - 2026-05-26-16-54-57.xlsx";

type Row = {
  "Job Division"?: string;
  "Job Address"?: string;
  "Job City"?: string;
  "Job Completion Date"?: string;
  "Stage Name"?: string;
};

function parseDate(s: string | undefined): string | null {
  if (!s) return null;
  // Excel may give us "06/15/2022" or an ISO. Normalize to YYYY-MM-DD.
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const [, mo, d, y] = m;
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  const dt = new Date(s);
  if (!isNaN(dt.getTime())) return dt.toISOString().slice(0, 10);
  return null;
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  console.log("Reading", FILE);
  const wb = XLSX.readFile(FILE);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Row>(sheet);
  console.log(`Found ${rows.length} rows`);

  const insert = db.prepare(`
    INSERT INTO projects (address, project_type, completed_date, lat, lng, geocoded, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const exists = db.prepare(
    "SELECT id, lat FROM projects WHERE address = ? AND IFNULL(completed_date,'') = IFNULL(?, '')"
  );

  let inserted = 0;
  let skipped = 0;
  let geocoded = 0;
  let failed = 0;

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const addr = (r["Job Address"] || "").trim();
    const city = (r["Job City"] || "Hoboken").trim();
    if (!addr) continue;
    const full = /\b(hoboken|nj|new jersey)\b/i.test(addr)
      ? addr
      : `${addr}, ${city}, NJ`;
    const date = parseDate(r["Job Completion Date"]);
    const type = (r["Job Division"] || "Full Roof").trim();

    const found = exists.get(full, date) as { id: number; lat: number | null } | undefined;
    if (found && found.lat != null) {
      skipped++;
      continue;
    }

    const geo = await geocodeAddress(full);
    if (geo) geocoded++;
    else failed++;

    if (found) {
      db.prepare(
        "UPDATE projects SET lat = ?, lng = ?, geocoded = ?, project_type = ? WHERE id = ?"
      ).run(geo?.lat ?? null, geo?.lng ?? null, geo ? 1 : 0, type, found.id);
    } else {
      insert.run(full, type, date, geo?.lat ?? null, geo?.lng ?? null, geo ? 1 : 0, null);
      inserted++;
    }

    if ((i + 1) % 10 === 0) {
      console.log(
        `${i + 1}/${rows.length}  inserted=${inserted} geocoded=${geocoded} failed=${failed} skipped=${skipped}`
      );
    }
    // Nominatim policy: max 1 req/sec.
    await sleep(1100);
  }

  console.log(
    `Done. inserted=${inserted} geocoded=${geocoded} failed=${failed} skipped=${skipped}`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
