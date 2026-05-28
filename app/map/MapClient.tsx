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
  const completed = projects.filter((p) => p.lat != null).length;
  return (
    <div style={{ position: "relative", width: "100%", height: "100vh" }}>
      <HobokenMap projects={projects} />

      {/* Logo card — top left */}
      <div
        style={{
          position: "absolute",
          top: 14,
          left: 14,
          background: "white",
          borderRadius: 10,
          padding: "10px 14px",
          boxShadow: "0 4px 16px rgba(15,79,138,.18)",
          display: "flex",
          alignItems: "center",
          gap: 10,
          zIndex: 5,
          maxWidth: 320,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo.png"
          alt="Capitol Roofing"
          style={{ height: 52, width: "auto", display: "block" }}
        />
        <div style={{ fontFamily: "system-ui", lineHeight: 1.15 }}>
          <div style={{ fontWeight: 700, color: "#0f4f8a", fontSize: 14 }}>
            Hoboken Projects
          </div>
          <div style={{ fontSize: 12, color: "#334155" }}>
            {completed} completed roofs — highlighted in blue
          </div>
        </div>
      </div>
    </div>
  );
}
