// Fast local lookup of Hoboken addresses, normalized so that
// "300 Monroe St" and "300 monroe street" both match.
import fs from "fs";
import path from "path";

type Entry = { a: string; lat: number; lng: number };

let LIST: Entry[] | null = null;
let INDEX: Map<string, Entry> | null = null;

const ST_ABBREV: Record<string, string> = {
  st: "street",
  street: "street",
  ave: "avenue",
  avenue: "avenue",
  rd: "road",
  road: "road",
  blvd: "boulevard",
  boulevard: "boulevard",
  pl: "place",
  place: "place",
  ct: "court",
  court: "court",
  ter: "terrace",
  terrace: "terrace",
  dr: "drive",
  drive: "drive",
  ln: "lane",
  lane: "lane",
};

function normalize(addr: string): string {
  return addr
    .toLowerCase()
    .replace(/[.,]/g, " ")
    .replace(/\bhoboken\b/g, "")
    .replace(/\bnj\b/g, "")
    .replace(/\b(\d{5})(-\d{4})?\b/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .map((tok) => ST_ABBREV[tok] || tok)
    .join(" ")
    .trim();
}

function load() {
  if (LIST) return;
  const p = path.join(process.cwd(), "public", "hoboken-addresses.json");
  if (!fs.existsSync(p)) {
    LIST = [];
    INDEX = new Map();
    return;
  }
  LIST = JSON.parse(fs.readFileSync(p, "utf-8")) as Entry[];
  INDEX = new Map();
  for (const e of LIST) {
    INDEX.set(normalize(e.a), e);
  }
}

export function lookupLocal(address: string): { lat: number; lng: number } | null {
  load();
  if (!INDEX) return null;
  const key = normalize(address);
  const hit = INDEX.get(key);
  if (hit) return { lat: hit.lat, lng: hit.lng };
  return null;
}
