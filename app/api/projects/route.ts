import { NextResponse } from "next/server";
import db from "@/lib/db";
import { geocodeAddress } from "@/lib/geocode";
import { lookupLocal } from "@/lib/local-addresses";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = db
    .prepare(
      "SELECT id, address, project_type, completed_date, lat, lng, geocoded, notes, footprint, created_at FROM projects ORDER BY completed_date DESC"
    )
    .all();
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const body = await req.json();
  const address = String(body.address || "").trim();
  if (!address) return NextResponse.json({ error: "address required" }, { status: 400 });

  const project_type = body.project_type ?? null;
  const completed_date = body.completed_date ?? null;
  const notes = body.notes ?? null;

  // Allow caller to supply coords (e.g. from autocomplete) and skip geocoding.
  // Otherwise, try local Hoboken address book first; fall back to Nominatim.
  const geo =
    typeof body.lat === "number" && typeof body.lng === "number"
      ? { lat: body.lat as number, lng: body.lng as number }
      : lookupLocal(address) || (await geocodeAddress(address));

  const info = db
    .prepare(
      `INSERT INTO projects (address, project_type, completed_date, lat, lng, geocoded, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      address,
      project_type,
      completed_date,
      geo?.lat ?? null,
      geo?.lng ?? null,
      geo ? 1 : 0,
      notes
    );

  const row = db.prepare("SELECT * FROM projects WHERE id = ?").get(info.lastInsertRowid);
  return NextResponse.json(row, { status: 201 });
}
