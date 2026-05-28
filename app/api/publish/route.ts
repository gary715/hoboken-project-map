import { NextResponse } from "next/server";
import db from "@/lib/db";

export const dynamic = "force-dynamic";

// Count of draft changes not yet pushed to the public map: rows that were
// added/edited since the last publish, plus rows that were deleted/un-geocoded.
const PENDING_SQL = `
SELECT
  (SELECT COUNT(*) FROM projects p
    WHERE p.lat IS NOT NULL AND p.lng IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM published_projects pp WHERE pp.id = p.id
        AND IFNULL(pp.lat, 0) = IFNULL(p.lat, 0)
        AND IFNULL(pp.lng, 0) = IFNULL(p.lng, 0)
        AND IFNULL(pp.footprint, '') = IFNULL(p.footprint, '')
        AND IFNULL(pp.address, '') = IFNULL(p.address, '')
        AND IFNULL(pp.project_type, '') = IFNULL(p.project_type, '')
        AND IFNULL(pp.completed_date, '') = IFNULL(p.completed_date, '')
        AND IFNULL(pp.notes, '') = IFNULL(p.notes, '')
    )) AS changed,
  (SELECT COUNT(*) FROM published_projects pp
    WHERE NOT EXISTS (
      SELECT 1 FROM projects p WHERE p.id = pp.id AND p.lat IS NOT NULL
    )) AS removed
`;

export async function GET() {
  const r = db.prepare(PENDING_SQL).get() as {
    changed: number;
    removed: number;
  };
  const published = (
    db.prepare("SELECT COUNT(*) AS c FROM published_projects").get() as {
      c: number;
    }
  ).c;
  return NextResponse.json({ pending: r.changed + r.removed, published });
}

export async function POST() {
  const snapshot = db.transaction(() => {
    db.prepare("DELETE FROM published_projects").run();
    db.prepare(
      `INSERT INTO published_projects
         (id, address, project_type, completed_date, lat, lng, notes, footprint)
       SELECT id, address, project_type, completed_date, lat, lng, notes, footprint
       FROM projects
       WHERE lat IS NOT NULL AND lng IS NOT NULL`
    ).run();
  });
  snapshot();
  const published = (
    db.prepare("SELECT COUNT(*) AS c FROM published_projects").get() as {
      c: number;
    }
  ).c;
  return NextResponse.json({ ok: true, published });
}
