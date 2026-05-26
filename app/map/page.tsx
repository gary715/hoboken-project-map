import db from "@/lib/db";
import MapClient from "./MapClient";

export const dynamic = "force-dynamic";

type Project = {
  id: number;
  address: string;
  project_type: string | null;
  completed_date: string | null;
  lat: number | null;
  lng: number | null;
  notes: string | null;
};

export default function MapPage() {
  const projects = db
    .prepare(
      "SELECT id, address, project_type, completed_date, lat, lng, notes FROM projects WHERE lat IS NOT NULL AND lng IS NOT NULL"
    )
    .all() as Project[];

  return (
    <main style={{ height: "100vh", width: "100vw", margin: 0 }}>
      <MapClient projects={projects} />
    </main>
  );
}
