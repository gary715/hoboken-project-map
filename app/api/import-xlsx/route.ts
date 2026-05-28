import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import db from "@/lib/db";
import { geocodeAddress } from "@/lib/geocode";
import { lookupLocal } from "@/lib/local-addresses";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // up to 5 min for big imports

type Row = Record<string, string | number | undefined>;

const ADDRESS_KEYS = [
  "Job Address",
  "Address",
  "Site Address",
  "Property Address",
  "Street Address",
];
const CITY_KEYS = ["Job City", "City"];
const TYPE_KEYS = ["Job Division", "Job Type", "Type", "Division"];
const DATE_KEYS = [
  "Job Completion Date",
  "Completion Date",
  "Completed",
  "Date Completed",
  "Date",
];

function pick(row: Row, keys: string[]): string {
  for (const k of keys) {
    const v = row[k];
    if (v != null && String(v).trim()) return String(v).trim();
  }
  return "";
}

function parseDate(s: string): string | null {
  if (!s) return null;
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const [, mo, d, y] = m;
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  const dt = new Date(s);
  if (!isNaN(dt.getTime())) return dt.toISOString().slice(0, 10);
  return null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function POST(req: Request) {
  const fd = await req.formData();
  const file = fd.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file missing" }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const wb = XLSX.read(buf, { type: "buffer" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Row>(sheet);

  const insert = db.prepare(
    `INSERT INTO projects (address, project_type, completed_date, lat, lng, geocoded, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  const exists = db.prepare(
    "SELECT id FROM projects WHERE LOWER(address) = LOWER(?) AND IFNULL(completed_date,'') = IFNULL(?, '')"
  );

  let imported = 0;
  let skipped = 0;
  let geocoded = 0;
  let failed = 0;
  let remoteCalls = 0;

  for (const r of rows) {
    const addrRaw = pick(r, ADDRESS_KEYS);
    if (!addrRaw) continue;
    const city = pick(r, CITY_KEYS) || "Hoboken";
    const full = /\b(hoboken|nj|new jersey)\b/i.test(addrRaw)
      ? addrRaw
      : `${addrRaw}, ${city}, NJ`;
    const date = parseDate(pick(r, DATE_KEYS));
    const type = pick(r, TYPE_KEYS) || "Full Roof";

    if (exists.get(full, date)) {
      skipped++;
      continue;
    }

    // local lookup first (free, instant)
    let geo = lookupLocal(full);
    if (!geo) {
      // Nominatim: 1 req/sec
      if (remoteCalls > 0) await sleep(1100);
      geo = await geocodeAddress(full);
      remoteCalls++;
    }
    if (geo) geocoded++;
    else failed++;

    insert.run(
      full,
      type,
      date,
      geo?.lat ?? null,
      geo?.lng ?? null,
      geo ? 1 : 0,
      null
    );
    imported++;
  }

  return NextResponse.json({
    total: rows.length,
    imported,
    skipped,
    geocoded,
    failed,
    remoteCalls,
  });
}
