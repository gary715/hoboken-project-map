import { NextResponse } from "next/server";
import db from "@/lib/db";
import { geocodeAddress } from "@/lib/geocode";

export const dynamic = "force-dynamic";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  db.prepare("DELETE FROM projects WHERE id = ?").run(Number(id));
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();

  if (body.regeocode) {
    const row = db.prepare("SELECT address FROM projects WHERE id = ?").get(Number(id)) as
      | { address: string }
      | undefined;
    if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });
    const geo = await geocodeAddress(row.address);
    db.prepare(
      "UPDATE projects SET lat = ?, lng = ?, geocoded = ?, footprint = NULL WHERE id = ?"
    ).run(geo?.lat ?? null, geo?.lng ?? null, geo ? 1 : 0, Number(id));
  }

  // Manual placement fix: caller supplies new coords and (optionally) the
  // clicked building footprint as a GeoJSON polygon.
  if (typeof body.lat === "number" && typeof body.lng === "number") {
    const footprint =
      body.footprint != null ? JSON.stringify(body.footprint) : null;
    db.prepare(
      "UPDATE projects SET lat = ?, lng = ?, geocoded = 1, footprint = ? WHERE id = ?"
    ).run(body.lat, body.lng, footprint, Number(id));
  }

  // Clear a placement back to nothing
  if (body.clearFootprint === true) {
    db.prepare("UPDATE projects SET footprint = NULL WHERE id = ?").run(
      Number(id)
    );
  }

  // Placement corrections push straight to the public map so the fix shows up
  // immediately (no separate Publish step needed for a single fix).
  if (body.publishNow === true) {
    const row = db
      .prepare(
        "SELECT id, address, project_type, completed_date, lat, lng, notes, footprint FROM projects WHERE id = ? AND lat IS NOT NULL AND lng IS NOT NULL"
      )
      .get(Number(id));
    if (row) {
      db.prepare(
        `INSERT INTO published_projects
           (id, address, project_type, completed_date, lat, lng, notes, footprint)
         VALUES (@id, @address, @project_type, @completed_date, @lat, @lng, @notes, @footprint)
         ON CONFLICT(id) DO UPDATE SET
           address = @address, project_type = @project_type,
           completed_date = @completed_date, lat = @lat, lng = @lng,
           notes = @notes, footprint = @footprint`
      ).run(row);
    }
  }

  const updated = db.prepare("SELECT * FROM projects WHERE id = ?").get(Number(id));
  return NextResponse.json(updated);
}
