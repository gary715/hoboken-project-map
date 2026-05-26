"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";

type Project = {
  id: number;
  address: string;
  project_type: string | null;
  completed_date: string | null;
  lat: number | null;
  lng: number | null;
  notes: string | null;
};

const HOBOKEN_CENTER: [number, number] = [40.744, -74.0324];

export default function HobokenMap({
  projects,
  height = "100vh",
}: {
  projects: Project[];
  height?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      center: HOBOKEN_CENTER,
      zoom: 15,
      scrollWheelZoom: true,
    });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);
    mapRef.current = map;
    layerRef.current = L.layerGroup().addTo(map);
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();

    const pts: L.LatLngExpression[] = [];
    for (const p of projects) {
      if (p.lat == null || p.lng == null) continue;
      const dot = L.circleMarker([p.lat, p.lng], {
        radius: 7,
        color: "#7f1d1d",
        weight: 1.5,
        fillColor: "#dc2626",
        fillOpacity: 0.85,
      });
      const date = p.completed_date
        ? new Date(p.completed_date).toLocaleDateString()
        : "";
      dot.bindPopup(
        `<b>${escapeHtml(p.address)}</b>` +
          (p.project_type ? `<br/>${escapeHtml(p.project_type)}` : "") +
          (date ? `<br/>Completed: ${date}` : "") +
          (p.notes ? `<br/><i>${escapeHtml(p.notes)}</i>` : "")
      );
      dot.addTo(layer);
      pts.push([p.lat, p.lng]);
    }

    if (pts.length > 1) {
      map.fitBounds(L.latLngBounds(pts), { padding: [30, 30], maxZoom: 16 });
    } else if (pts.length === 1) {
      map.setView(pts[0] as [number, number], 17);
    }
  }, [projects]);

  return <div ref={containerRef} style={{ width: "100%", height }} />;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
