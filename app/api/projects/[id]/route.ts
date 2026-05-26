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
      "UPDATE projects SET lat = ?, lng = ?, geocoded = ? WHERE id = ?"
    ).run(geo?.lat ?? null, geo?.lng ?? null, geo ? 1 : 0, Number(id));
  }

  const updated = db.prepare("SELECT * FROM projects WHERE id = ?").get(Number(id));
  return NextResponse.json(updated);
}
