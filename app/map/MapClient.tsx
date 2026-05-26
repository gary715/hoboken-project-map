"use client";

import dynamic from "next/dynamic";

const HobokenMap = dynamic(() => import("../components/HobokenMap"), {
  ssr: false,
  loading: () => <div className="p-6 text-gray-500">Loading map…</div>,
});

type Project = {
  id: number;
  address: string;
  project_type: string | null;
  completed_date: string | null;
  lat: number | null;
  lng: number | null;
  notes: string | null;
};

export default function MapClient({ projects }: { projects: Project[] }) {
  return <HobokenMap projects={projects} />;
}
