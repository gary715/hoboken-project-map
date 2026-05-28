"use client";

import { useEffect, useRef } from "react";
import maplibregl, { Map as MLMap, Popup, GeoJSONSource } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

type Project = {
  id: number;
  address: string;
  project_type: string | null;
  completed_date: string | null;
  lat: number | null;
  lng: number | null;
  notes: string | null;
  footprint?: string | null;
};

export type BuildingPick = {
  lng: number;
  lat: number;
  footprint: GeoJSON.Polygon | GeoJSON.MultiPolygon;
};

const HOBOKEN_CENTER: [number, number] = [-74.0324, 40.744]; // [lng, lat]
const STYLE_URL = "https://tiles.openfreemap.org/styles/positron";
const HOBOKEN_BOUNDS: [[number, number], [number, number]] = [
  [-74.0540, 40.7290], // SW — extended west past CR681 (Paterson Plank Rd)
  [-74.0115, 40.7605], // NE
];
const WORLD_RING: [number, number][] = [
  [-180, -85],
  [180, -85],
  [180, 85],
  [-180, 85],
  [-180, -85],
];

// Capitol Roofing blue (from logo)
const CAPITOL_BLUE = "#1d75c4";
const CAPITOL_BLUE_DARK = "#0f4f8a";

export default function HobokenMap({
  projects,
  height = "100vh",
  editMode = false,
  onBuildingPick,
  flyTo = null,
  previewPick = null,
  showLotNumbers = false,
}: {
  projects: Project[];
  height?: string;
  editMode?: boolean;
  onBuildingPick?: (pick: BuildingPick) => void;
  flyTo?: { lng: number; lat: number } | null;
  previewPick?: BuildingPick | null;
  showLotNumbers?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const loadedRef = useRef(false);
  const projectsRef = useRef<Project[]>(projects);
  const editRef = useRef(editMode);
  const onPickRef = useRef(onBuildingPick);
  const pulseRafRef = useRef(0);
  const lotRef = useRef(showLotNumbers);
  lotRef.current = showLotNumbers;

  // keep latest values accessible inside persistent event handlers
  projectsRef.current = projects;
  editRef.current = editMode;
  onPickRef.current = onBuildingPick;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE_URL,
      center: HOBOKEN_CENTER,
      zoom: 15.2,
      pitch: 38,
      bearing: -18,
      maxPitch: 70,
      minZoom: 13,
      maxBounds: HOBOKEN_BOUNDS,
      attributionControl: { compact: true },
    });
    mapRef.current = map;

    map.addControl(
      new maplibregl.NavigationControl({ visualizePitch: true }),
      "top-right"
    );

    map.on("load", () => {
      const layers = map.getStyle().layers || [];
      const firstSymbol = layers.find((l) => l.type === "symbol")?.id;

      // Hoboken boundary mask + outline. Uses the BUFFERED boundary so the
      // border wraps around edge buildings instead of slicing through them.
      // Mask inserted BELOW labels so street names stay visible on both sides.
      fetch("/hoboken-buffered.geojson")
        .then((r) => r.json())
        .then((geo) => {
          const hobokenFeature = geo.features?.[0];
          if (!hobokenFeature) return;
          const hobokenCoords = hobokenFeature.geometry.coordinates as number[][][];

          const maskFeature = {
            type: "Feature" as const,
            properties: {},
            geometry: {
              type: "Polygon" as const,
              coordinates: [WORLD_RING, ...hobokenCoords],
            },
          };
          if (!map.getSource("hoboken-mask")) {
            map.addSource("hoboken-mask", {
              type: "geojson",
              data: { type: "FeatureCollection", features: [maskFeature] },
            });
            map.addLayer(
              {
                id: "hoboken-mask-fill",
                type: "fill",
                source: "hoboken-mask",
                paint: {
                  "fill-color": "#ffffff",
                  "fill-opacity": 0.55,
                },
              },
              firstSymbol
            );
          }
          if (!map.getSource("hoboken-outline")) {
            map.addSource("hoboken-outline", {
              type: "geojson",
              data: { type: "FeatureCollection", features: [hobokenFeature] },
            });
            map.addLayer(
              {
                id: "hoboken-outline-line",
                type: "line",
                source: "hoboken-outline",
                paint: {
                  "line-color": CAPITOL_BLUE,
                  "line-width": 3,
                  "line-opacity": 0.95,
                },
              },
              firstSymbol
            );
          }
        })
        .catch(() => {});

      // Base 3D buildings — light grey blank shapes
      if (!map.getLayer("3d-buildings")) {
        map.addLayer(
          {
            id: "3d-buildings",
            source: "openmaptiles",
            "source-layer": "building",
            type: "fill-extrusion",
            minzoom: 13,
            paint: {
              "fill-extrusion-color": "#e6e8eb",
              "fill-extrusion-height": [
                "interpolate",
                ["linear"],
                ["zoom"],
                13,
                0,
                14,
                ["coalesce", ["get", "render_height"], 8],
              ],
              "fill-extrusion-base": [
                "coalesce",
                ["get", "render_min_height"],
                0,
              ],
              "fill-extrusion-opacity": 0.92,
            },
          },
          firstSymbol
        );
      }

      // Highlighted buildings — Capitol blue extrusion overlay
      if (!map.getSource("highlighted-buildings")) {
        map.addSource("highlighted-buildings", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
      }
      if (!map.getLayer("highlighted-buildings-fill")) {
        map.addLayer(
          {
            id: "highlighted-buildings-fill",
            source: "highlighted-buildings",
            type: "fill-extrusion",
            paint: {
              "fill-extrusion-color": CAPITOL_BLUE,
              "fill-extrusion-height": [
                "coalesce",
                ["get", "render_height"],
                10,
              ],
              "fill-extrusion-base": [
                "coalesce",
                ["get", "render_min_height"],
                0,
              ],
              "fill-extrusion-opacity": 0.95,
            },
          },
          firstSymbol
        );
      }
      if (!map.getLayer("highlighted-buildings-line")) {
        map.addLayer(
          {
            id: "highlighted-buildings-line",
            source: "highlighted-buildings",
            type: "line",
            paint: {
              "line-color": CAPITOL_BLUE_DARK,
              "line-width": 1.4,
              "line-opacity": 0.9,
            },
          },
          firstSymbol
        );
      }

      // Focus pulse — the building the active project currently points at.
      // Blinks amber so the user can confirm which building they are fixing.
      if (!map.getSource("focus-building")) {
        map.addSource("focus-building", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
      }
      if (!map.getLayer("focus-building-fill")) {
        map.addLayer(
          {
            id: "focus-building-fill",
            source: "focus-building",
            type: "fill-extrusion",
            paint: {
              "fill-extrusion-color": "#f59e0b",
              "fill-extrusion-height": ["coalesce", ["get", "render_height"], 12],
              "fill-extrusion-base": 0,
              "fill-extrusion-opacity": 0.85,
            },
          },
          firstSymbol
        );
      }

      // Preview of the staged pick (before Save) — solid orange.
      if (!map.getSource("preview-building")) {
        map.addSource("preview-building", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
      }
      if (!map.getLayer("preview-building-fill")) {
        map.addLayer(
          {
            id: "preview-building-fill",
            source: "preview-building",
            type: "fill-extrusion",
            paint: {
              "fill-extrusion-color": "#ea580c",
              "fill-extrusion-height": ["coalesce", ["get", "render_height"], 12],
              "fill-extrusion-base": 0,
              "fill-extrusion-opacity": 0.92,
            },
          },
          firstSymbol
        );
      }
      if (!map.getLayer("preview-building-line")) {
        map.addLayer(
          {
            id: "preview-building-line",
            source: "preview-building",
            type: "line",
            paint: {
              "line-color": "#9a3412",
              "line-width": 1.6,
              "line-opacity": 0.95,
            },
          },
          firstSymbol
        );
      }

      // Click highlighted building → popup (only when NOT editing)
      map.on("click", "highlighted-buildings-fill", (e) => {
        if (editRef.current) return;
        const f = e.features?.[0];
        if (!f) return;
        const p = f.properties as Record<string, string>;
        const date = p.completed_date
          ? new Date(p.completed_date).toLocaleDateString()
          : "";
        const html =
          `<div style="font-family:system-ui;font-size:13px;line-height:1.4;color:#0f172a">` +
          `<b style="color:${CAPITOL_BLUE_DARK}">${esc(p.address || "")}</b>` +
          (p.project_type ? `<br/>${esc(p.project_type)}` : "") +
          (date ? `<br/>Completed: ${date}` : "") +
          (p.notes ? `<br/><i>${esc(p.notes)}</i>` : "") +
          `</div>`;
        new Popup({ offset: 12 })
          .setLngLat(e.lngLat)
          .setHTML(html)
          .addTo(map);
      });
      map.on("mouseenter", "highlighted-buildings-fill", () => {
        if (!editRef.current) map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "highlighted-buildings-fill", () => {
        if (!editRef.current) map.getCanvas().style.cursor = "";
      });

      // EDIT MODE: click any building to "fill" it for the active project.
      map.on("click", (e) => {
        if (!editRef.current || !onPickRef.current) return;
        const hits = map.queryRenderedFeatures(e.point, {
          layers: ["3d-buildings"],
        });
        if (hits.length === 0) return;
        const raw = hits[0].geometry as GeoJSON.Polygon | GeoJSON.MultiPolygon;
        // OpenMapTiles returns many buildings merged into one MultiPolygon.
        // Isolate just the single building footprint under the click.
        const single = selectPolygonAt(raw, e.lngLat.lng, e.lngLat.lat);
        if (!single) return;
        const c = polygonCentroid(single);
        if (!c) return;
        onPickRef.current({ lng: c[0], lat: c[1], footprint: single });
      });

      // Re-run highlight after each render so newly-loaded footprints appear
      let raf = 0;
      map.on("idle", () => {
        if (raf) cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => {
          highlightBuildings(map, projectsRef.current);
        });
      });

      // Admin only: show house/lot numbers when zoomed in to help identify
      // the correct building while correcting placements.
      if (lotRef.current) {
        fetch("/hoboken-addresses.json", { cache: "force-cache" })
          .then((r) => r.json())
          .then((rows: { a: string; lat: number; lng: number }[]) => {
            const features: GeoJSON.Feature[] = rows.map((row) => ({
              type: "Feature",
              geometry: { type: "Point", coordinates: [row.lng, row.lat] },
              properties: { num: row.a.match(/^\d+[A-Za-z]?/)?.[0] ?? "" },
            }));
            if (!map.getSource("lot-numbers")) {
              map.addSource("lot-numbers", {
                type: "geojson",
                data: { type: "FeatureCollection", features },
              });
            }
            if (!map.getLayer("lot-numbers-label")) {
              map.addLayer({
                id: "lot-numbers-label",
                source: "lot-numbers",
                type: "symbol",
                minzoom: 16,
                layout: {
                  "text-field": ["get", "num"],
                  "text-size": 11,
                  "text-font": ["Noto Sans Bold"],
                  "text-allow-overlap": false,
                },
                paint: {
                  "text-color": CAPITOL_BLUE_DARK,
                  "text-halo-color": "#ffffff",
                  "text-halo-width": 1.6,
                },
              });
            }
          })
          .catch(() => {});
      }

      loadedRef.current = true;
      highlightBuildings(map, projectsRef.current);
    });

    return () => {
      cancelAnimationFrame(pulseRafRef.current);
      map.remove();
      mapRef.current = null;
      loadedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-run highlight when projects change
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    highlightBuildings(map, projects);
  }, [projects]);

  // Reflect edit-mode cursor
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.getCanvas().style.cursor = editMode ? "crosshair" : "";
  }, [editMode]);

  // Fly to the project being fixed and "blink" its current building so the
  // user can see exactly which one they are about to correct.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;

    if (!flyTo) {
      stopPulse(map, pulseRafRef);
      clearSource(map, "focus-building");
      return;
    }

    map.flyTo({
      center: [flyTo.lng, flyTo.lat],
      zoom: 17.4,
      pitch: 45,
      duration: 900,
    });

    const onEnd = () => {
      const px = map.project([flyTo.lng, flyTo.lat]);
      const hits = map.queryRenderedFeatures([px.x, px.y], {
        layers: ["3d-buildings"],
      });
      const raw = hits[0]?.geometry;
      const single =
        raw && (raw.type === "Polygon" || raw.type === "MultiPolygon")
          ? selectPolygonAt(raw, flyTo.lng, flyTo.lat)
          : null;
      const height =
        typeof hits[0]?.properties?.render_height === "number"
          ? (hits[0]!.properties!.render_height as number)
          : 12;
      const feature: GeoJSON.Feature = {
        type: "Feature",
        geometry: single ?? {
          type: "Polygon",
          coordinates: roofPatch(flyTo.lng, flyTo.lat, 6),
        },
        properties: { render_height: height },
      };
      setSource(map, "focus-building", [feature]);
      startPulse(map, pulseRafRef);
    };
    map.once("moveend", onEnd);
    return () => {
      map.off("moveend", onEnd);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flyTo?.lng, flyTo?.lat]);

  // Render the staged pick (orange) and stop the blink once a pick is made.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    if (!previewPick) {
      clearSource(map, "preview-building");
      return;
    }
    stopPulse(map, pulseRafRef);
    clearSource(map, "focus-building");
    const px = map.project([previewPick.lng, previewPick.lat]);
    const hits = map.queryRenderedFeatures([px.x, px.y], {
      layers: ["3d-buildings"],
    });
    const height =
      typeof hits[0]?.properties?.render_height === "number"
        ? (hits[0]!.properties!.render_height as number)
        : 12;
    setSource(map, "preview-building", [
      {
        type: "Feature",
        geometry: previewPick.footprint,
        properties: { render_height: height },
      },
    ]);
  }, [previewPick]);

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", height }}
      className="maplibre-host"
    />
  );
}

// ~7m square roof patch centered at lat/lng (fallback when no stored footprint).
function roofPatch(
  lng: number,
  lat: number,
  halfMeters = 3.5
): GeoJSON.Position[][] {
  const dLat = halfMeters / 111320;
  const dLng = halfMeters / (111320 * Math.cos((lat * Math.PI) / 180));
  return [
    [
      [lng - dLng, lat - dLat],
      [lng + dLng, lat - dLat],
      [lng + dLng, lat + dLat],
      [lng - dLng, lat + dLat],
      [lng - dLng, lat - dLat],
    ],
  ];
}

function setSource(map: MLMap, id: string, features: GeoJSON.Feature[]) {
  const src = map.getSource(id) as GeoJSONSource | undefined;
  if (src) src.setData({ type: "FeatureCollection", features });
}

function clearSource(map: MLMap, id: string) {
  setSource(map, id, []);
}

function startPulse(map: MLMap, rafRef: { current: number }) {
  cancelAnimationFrame(rafRef.current);
  const t0 = performance.now();
  const tick = (t: number) => {
    const phase = (Math.sin((t - t0) / 280) + 1) / 2; // 0..1
    if (map.getLayer("focus-building-fill")) {
      map.setPaintProperty(
        "focus-building-fill",
        "fill-extrusion-opacity",
        0.3 + phase * 0.6
      );
    }
    rafRef.current = requestAnimationFrame(tick);
  };
  rafRef.current = requestAnimationFrame(tick);
}

function stopPulse(map: MLMap, rafRef: { current: number }) {
  cancelAnimationFrame(rafRef.current);
  rafRef.current = 0;
  if (map.getLayer("focus-building-fill")) {
    map.setPaintProperty("focus-building-fill", "fill-extrusion-opacity", 0.85);
  }
}

// Ray-casting point-in-polygon test against a ring of [lng,lat] positions.
function pointInRing(lng: number, lat: number, ring: GeoJSON.Position[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0],
      yi = ring[i][1];
    const xj = ring[j][0],
      yj = ring[j][1];
    const intersect =
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

// Reduce a (possibly merged) building geometry to the single Polygon that
// contains the clicked point — so one click "fills" exactly one building.
function selectPolygonAt(
  geom: GeoJSON.Polygon | GeoJSON.MultiPolygon,
  lng: number,
  lat: number
): GeoJSON.Polygon | null {
  if (geom.type === "Polygon") return geom;
  for (const poly of geom.coordinates) {
    if (poly[0] && pointInRing(lng, lat, poly[0])) {
      return { type: "Polygon", coordinates: poly };
    }
  }
  // Fallback: nearest sub-polygon by first-vertex distance.
  let best: GeoJSON.Position[][] | null = null;
  let bestD = Infinity;
  for (const poly of geom.coordinates) {
    const p0 = poly[0]?.[0];
    if (!p0) continue;
    const d = (p0[0] - lng) ** 2 + (p0[1] - lat) ** 2;
    if (d < bestD) {
      bestD = d;
      best = poly;
    }
  }
  return best ? { type: "Polygon", coordinates: best } : null;
}

function polygonCentroid(
  geom: GeoJSON.Polygon | GeoJSON.MultiPolygon
): [number, number] | null {
  const ring =
    geom.type === "Polygon"
      ? geom.coordinates[0]
      : geom.coordinates[0]?.[0];
  if (!ring || ring.length === 0) return null;
  let x = 0;
  let y = 0;
  for (const p of ring) {
    x += p[0];
    y += p[1];
  }
  return [x / ring.length, y / ring.length];
}

function highlightBuildings(map: MLMap, projects: Project[]) {
  if (!map.getLayer("3d-buildings")) return;

  const features: GeoJSON.Feature[] = [];

  for (const p of projects) {
    if (p.lat == null || p.lng == null) continue;

    // Parse stored footprint (manual placement) if present.
    let storedGeom: GeoJSON.Geometry | null = null;
    if (p.footprint) {
      try {
        storedGeom = JSON.parse(p.footprint) as GeoJSON.Geometry;
      } catch {
        storedGeom = null;
      }
    }

    // Query the actual OSM building under the placement point — both for its
    // height AND its footprint, so the highlight fills the real roof shape
    // instead of a fixed square patch.
    let height = 10;
    let queriedGeom: GeoJSON.Polygon | null = null;
    const px = map.project([p.lng, p.lat]);
    const under = map.queryRenderedFeatures([px.x, px.y], {
      layers: ["3d-buildings"],
    });
    if (under.length > 0) {
      const h = under[0].properties?.render_height;
      if (typeof h === "number" && h > 0) height = h;
      const g = under[0].geometry;
      if (g.type === "Polygon" || g.type === "MultiPolygon") {
        // OSM merges many buildings into one MultiPolygon — isolate the one
        // actually under the point.
        queriedGeom = selectPolygonAt(g, p.lng, p.lat);
      }
    }

    // Prefer a manual fix, else the real building footprint, else a small patch.
    const realGeom = storedGeom ?? queriedGeom;
    const geometry: GeoJSON.Geometry = realGeom ?? {
      type: "Polygon",
      coordinates: roofPatch(p.lng, p.lat),
    };

    features.push({
      type: "Feature",
      geometry,
      properties: {
        project_id: p.id,
        address: p.address,
        project_type: p.project_type ?? "",
        completed_date: p.completed_date ?? "",
        notes: p.notes ?? "",
        render_height: height,
        render_min_height: realGeom ? 0 : Math.max(0, height - 0.5),
      },
    });
  }

  const src = map.getSource("highlighted-buildings") as
    | GeoJSONSource
    | undefined;
  if (src) {
    src.setData({ type: "FeatureCollection", features });
  }
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
