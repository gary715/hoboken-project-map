import { NextResponse } from "next/server";
import db from "@/lib/db";
import { lookupLocal } from "@/lib/local-addresses";

export const dynamic = "force-dynamic";

// Free, offline confidence checks against the authoritative Hoboken address
// book (public/hoboken-addresses.json). No external/paid APIs.
//  - "off": the address exists in the book but the stored placement is far
//           from it → likely misplaced, and we can suggest the right spot.
//  - "unverified": no book match and never manually confirmed (no footprint).

const OFF_THRESHOLD_M = 35;

function distMeters(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number
): number {
  const R = 6371000;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const la1 = (aLat * Math.PI) / 180;
  const la2 = (bLat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

type Row = {
  id: number;
  address: string;
  lat: number;
  lng: number;
  footprint: string | null;
};

type Flag = {
  id: number;
  level: "off" | "unverified";
  reason: string;
  distance: number | null;
  suggestedLat: number | null;
  suggestedLng: number | null;
};

export async function GET() {
  const rows = db
    .prepare(
      "SELECT id, address, lat, lng, footprint FROM projects WHERE lat IS NOT NULL AND lng IS NOT NULL"
    )
    .all() as Row[];

  const flags: Flag[] = [];
  for (const r of rows) {
    const book = lookupLocal(r.address);
    if (book) {
      const d = distMeters(r.lat, r.lng, book.lat, book.lng);
      if (d > OFF_THRESHOLD_M) {
        flags.push({
          id: r.id,
          level: "off",
          reason: `Placement is ${Math.round(
            d
          )}m from the address-book location for this address`,
          distance: Math.round(d),
          suggestedLat: book.lat,
          suggestedLng: book.lng,
        });
      }
    } else if (!r.footprint) {
      flags.push({
        id: r.id,
        level: "unverified",
        reason:
          "Address not found in the Hoboken address book and placement was never manually confirmed",
        distance: null,
        suggestedLat: null,
        suggestedLng: null,
      });
    }
  }

  // Most-off first.
  flags.sort((a, b) => (b.distance ?? -1) - (a.distance ?? -1));
  return NextResponse.json(flags);
}
