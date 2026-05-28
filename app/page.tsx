"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import AddressAutocomplete from "./components/AddressAutocomplete";
import type { BuildingPick } from "./components/HobokenMap";

const HobokenMap = dynamic(() => import("./components/HobokenMap"), {
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
  geocoded: number;
  notes: string | null;
  footprint: string | null;
  created_at: string;
};

type Flag = {
  id: number;
  level: "off" | "unverified";
  reason: string;
  distance: number | null;
  suggestedLat: number | null;
  suggestedLng: number | null;
};

export default function AdminPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [filter, setFilter] = useState("");
  const [form, setForm] = useState<{
    address: string;
    lat: number | null;
    lng: number | null;
    project_type: string;
    completed_date: string;
    notes: string;
  }>({
    address: "",
    lat: null,
    lng: null,
    project_type: "Full Roof",
    completed_date: "",
    notes: "",
  });
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);
  const [fixingId, setFixingId] = useState<number | null>(null);
  const [pendingPick, setPendingPick] = useState<BuildingPick | null>(null);
  const [savingPick, setSavingPick] = useState(false);
  const [pending, setPending] = useState(0);
  const [publishing, setPublishing] = useState(false);
  const [flags, setFlags] = useState<Flag[]>([]);
  const [showFlaggedOnly, setShowFlaggedOnly] = useState(false);

  const flagById = useMemo(() => {
    const m = new Map<number, Flag>();
    for (const f of flags) m.set(f.id, f);
    return m;
  }, [flags]);
  const offCount = flags.filter((f) => f.level === "off").length;
  const unverifiedCount = flags.filter((f) => f.level === "unverified").length;

  const fixingProject = projects.find((p) => p.id === fixingId) || null;
  const fixingFlag = fixingId != null ? flagById.get(fixingId) || null : null;
  const flyTarget =
    fixingProject && fixingProject.lat != null && fixingProject.lng != null
      ? { lng: fixingProject.lng, lat: fixingProject.lat }
      : null;

  function cancelFix() {
    setFixingId(null);
    setPendingPick(null);
  }

  function startFix(id: number) {
    setPendingPick(null);
    setFixingId(fixingId === id ? null : id);
  }

  async function refresh() {
    setLoading(true);
    const res = await fetch("/api/projects", { cache: "no-store" });
    setProjects(await res.json());
    setLoading(false);
    refreshStatus();
  }

  async function refreshStatus() {
    const [pub, rev] = await Promise.all([
      fetch("/api/publish", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/review", { cache: "no-store" }).then((r) => r.json()),
    ]);
    setPending(pub.pending ?? 0);
    setFlags(rev ?? []);
  }

  async function publish() {
    setPublishing(true);
    await fetch("/api/publish", { method: "POST" });
    setPublishing(false);
    refreshStatus();
  }

  async function snapToBook() {
    if (fixingId == null || !fixingFlag?.suggestedLat || !fixingFlag.suggestedLng)
      return;
    await fetch(`/api/projects/${fixingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lat: fixingFlag.suggestedLat,
        lng: fixingFlag.suggestedLng,
        clearFootprint: true,
        publishNow: true,
      }),
    });
    cancelFix();
    refresh();
  }

  function handleBuildingPick(pick: BuildingPick) {
    if (fixingId == null) return;
    // Stage the pick so the user can confirm the shape before saving.
    setPendingPick(pick);
  }

  async function savePlacement() {
    if (fixingId == null || !pendingPick) return;
    setSavingPick(true);
    await fetch(`/api/projects/${fixingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lat: pendingPick.lat,
        lng: pendingPick.lng,
        footprint: pendingPick.footprint,
        publishNow: true,
      }),
    });
    setSavingPick(false);
    setPendingPick(null);
    setFixingId(null);
    refresh();
  }

  // Esc cancels placement mode
  useEffect(() => {
    if (fixingId == null) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") cancelFix();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fixingId]);

  useEffect(() => {
    refresh();
  }, []);

  async function addProject(e: React.FormEvent) {
    e.preventDefault();
    if (!form.address.trim()) return;
    setAdding(true);
    await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setForm({ ...form, address: "", lat: null, lng: null, notes: "" });
    setAdding(false);
    refresh();
  }

  async function uploadXlsx(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/import-xlsx", { method: "POST", body: fd });
    const json = await res.json();
    setImporting(false);
    setImportResult(
      res.ok
        ? `Imported ${json.imported} new · ${json.skipped} duplicates · ${json.geocoded} geocoded`
        : `Error: ${json.error || res.statusText}`
    );
    e.target.value = "";
    refresh();
  }

  async function remove(id: number) {
    if (!confirm("Delete this project?")) return;
    await fetch(`/api/projects/${id}`, { method: "DELETE" });
    refresh();
  }

  async function regeocode(id: number) {
    await fetch(`/api/projects/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ regeocode: true }),
    });
    refresh();
  }

  const filtered = useMemo(
    () =>
      projects.filter(
        (p) =>
          p.address.toLowerCase().includes(filter.toLowerCase()) &&
          (!showFlaggedOnly || flagById.get(p.id)?.level === "off")
      ),
    [projects, filter, showFlaggedOnly, flagById]
  );

  const geocoded = projects.filter((p) => p.lat != null);
  const ungeocoded = projects.filter((p) => p.lat == null);

  return (
    <main className="min-h-screen bg-gray-50">
      <header
        className="bg-white text-slate-900 px-6 py-3 shadow flex items-center gap-4"
        style={{ borderBottom: "3px solid #1d75c4" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="Capitol Roofing" className="h-12 w-auto" />
        <div className="flex-1">
          <h1 className="text-xl font-bold" style={{ color: "#0f4f8a" }}>
            Hoboken Project Map — Admin
          </h1>
          <p className="text-sm text-slate-600">
            {projects.length} projects · {geocoded.length} mapped ·{" "}
            {ungeocoded.length} need geocoding ·{" "}
            <a
              className="underline"
              style={{ color: "#1d75c4" }}
              href="/map"
              target="_blank"
            >
              Open public map ↗
            </a>{" "}
            ·{" "}
            <a
              className="underline"
              style={{ color: "#1d75c4" }}
              href="/embed-snippet"
              target="_blank"
            >
              Embed code
            </a>
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <button
            onClick={publish}
            disabled={publishing || pending === 0}
            className="text-white text-sm font-semibold rounded px-4 py-2 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: pending > 0 ? "#16a34a" : "#94a3b8" }}
            title="Copy the current draft to the public website map"
          >
            {publishing
              ? "Publishing…"
              : pending > 0
              ? `Publish ${pending} change${pending === 1 ? "" : "s"} →`
              : "Published ✓"}
          </button>
          <div className="text-[11px] text-slate-500">
            {pending > 0
              ? "Draft has unpublished edits"
              : "Website is up to date"}
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-4 p-4">
        <section className="bg-white rounded shadow p-4 space-y-4">
          <form onSubmit={addProject} className="space-y-3">
            <h2 className="font-semibold">Add project</h2>
            <AddressAutocomplete
              value={form.address}
              required
              onChange={(v) =>
                setForm({ ...form, address: v.address, lat: v.lat, lng: v.lng })
              }
            />
            {form.lat != null && (
              <div className="text-[11px] text-green-700 -mt-1">
                ✓ Matched in Hoboken address book (no geocode needed)
              </div>
            )}
            <div className="flex gap-2">
              <input
                className="flex-1 border rounded px-2 py-1.5 text-sm"
                placeholder="Type (e.g. Full Roof)"
                value={form.project_type}
                onChange={(e) => setForm({ ...form, project_type: e.target.value })}
              />
              <input
                type="date"
                className="border rounded px-2 py-1.5 text-sm"
                value={form.completed_date}
                onChange={(e) => setForm({ ...form, completed_date: e.target.value })}
              />
            </div>
            <textarea
              className="w-full border rounded px-2 py-1.5 text-sm"
              placeholder="Notes (optional)"
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
            <button
              type="submit"
              disabled={adding}
              className="disabled:opacity-50 text-white text-sm rounded px-3 py-1.5"
              style={{ background: "#1d75c4" }}
            >
              {adding ? "Adding & geocoding…" : "Add project"}
            </button>
          </form>

          <div className="border-t pt-3">
            <h2 className="font-semibold mb-2">Import from CRM spreadsheet</h2>
            <p className="text-xs text-gray-600 mb-2">
              Drop an .xlsx exported from your CRM. Recognized columns:{" "}
              <code>Job Address</code>, <code>Job City</code>,{" "}
              <code>Job Completion Date</code>, <code>Job Division</code>{" "}
              (also accepts <code>Address</code>, <code>Date</code>,{" "}
              <code>Type</code>).
            </p>
            <label
              className={`block w-full text-center text-sm rounded border-2 border-dashed px-3 py-3 cursor-pointer ${
                importing
                  ? "bg-gray-100 border-gray-300 text-gray-500"
                  : "bg-blue-50 border-blue-300 hover:bg-blue-100 text-blue-800"
              }`}
            >
              {importing ? "Importing & geocoding…" : "Choose .xlsx file to import"}
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={uploadXlsx}
                disabled={importing}
                className="hidden"
              />
            </label>
            {importResult && (
              <div className="text-xs mt-2 text-gray-700 bg-gray-50 border rounded px-2 py-1">
                {importResult}
              </div>
            )}
          </div>

          <div>
            <input
              className="w-full border rounded px-2 py-1.5 text-sm mb-2"
              placeholder="Filter by address…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
            {(offCount > 0 || unverifiedCount > 0) && (
              <div className="text-xs mb-2 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-amber-800">
                    {offCount > 0 ? (
                      <>
                        <b>⚠ {offCount}</b> likely misplaced (disagree with the
                        address book)
                      </>
                    ) : (
                      "No misplaced addresses detected"
                    )}
                  </span>
                  {offCount > 0 && (
                    <label className="flex items-center gap-1 cursor-pointer text-amber-800 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={showFlaggedOnly}
                        onChange={(e) => setShowFlaggedOnly(e.target.checked)}
                      />
                      Show these only
                    </label>
                  )}
                </div>
                {unverifiedCount > 0 && (
                  <div className="text-[11px] text-amber-700/70 mt-0.5">
                    {unverifiedCount} not in the reference address book (can&apos;t
                    auto-verify)
                  </div>
                )}
              </div>
            )}
            <div className="text-xs text-gray-500 mb-1">
              Showing {filtered.length} of {projects.length}
            </div>
            <div className="max-h-[60vh] overflow-auto border rounded">
              <table className="w-full text-xs">
                <thead className="bg-gray-100 sticky top-0">
                  <tr className="text-left">
                    <th className="px-2 py-1">Address</th>
                    <th className="px-2 py-1">Date</th>
                    <th className="px-2 py-1">Mapped</th>
                    <th className="px-2 py-1"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => (
                    <tr
                      key={p.id}
                      className={`border-t hover:bg-gray-50 ${
                        fixingId === p.id ? "bg-blue-50" : ""
                      }`}
                    >
                      <td className="px-2 py-1">
                        {p.address}
                        {p.footprint && (
                          <span
                            title="Placement manually corrected"
                            className="ml-1 text-[10px]"
                            style={{ color: "#1d75c4" }}
                          >
                            ●
                          </span>
                        )}
                        {flagById.get(p.id)?.level === "off" && (
                          <span
                            title={flagById.get(p.id)!.reason}
                            className="ml-1 text-[10px] text-amber-600"
                          >
                            ⚠
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-1">{p.completed_date || ""}</td>
                      <td className="px-2 py-1">
                        {p.lat != null ? (
                          <span className="text-green-700">✓</span>
                        ) : (
                          <button
                            onClick={() => regeocode(p.id)}
                            className="text-blue-700 underline"
                          >
                            geocode
                          </button>
                        )}
                      </td>
                      <td className="px-2 py-1 text-right whitespace-nowrap">
                        {p.lat != null && (
                          <button
                            onClick={() => startFix(p.id)}
                            className="hover:underline mr-2"
                            style={{ color: "#1d75c4" }}
                          >
                            {fixingId === p.id ? "cancel" : "fix"}
                          </button>
                        )}
                        <button
                          onClick={() => remove(p.id)}
                          className="text-red-700 hover:underline"
                        >
                          delete
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!loading && filtered.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-2 py-3 text-center text-gray-500">
                        No projects yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="bg-white rounded shadow overflow-hidden relative">
          {fixingProject && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 w-[min(560px,90%)]">
              <div
                className="rounded-lg shadow-lg px-4 py-3 text-sm text-white flex items-center gap-3"
                style={{ background: "#0f4f8a" }}
              >
                <span className="text-lg leading-none">🖌</span>
                <div className="flex-1 leading-tight">
                  {pendingPick ? (
                    <>
                      <b>Confirm placement</b> for{" "}
                      <span className="underline">{fixingProject.address}</span>.
                      <div className="text-[11px] opacity-90">
                        The orange shape shows the roof you selected. Click a
                        different building to change it.
                      </div>
                    </>
                  ) : (
                    <>
                      Click the correct building for{" "}
                      <span className="underline">{fixingProject.address}</span>.
                      <div className="text-[11px] opacity-90">
                        {fixingFlag
                          ? `⚠ ${fixingFlag.reason}.`
                          : "The map is centered on its current placement. Press Esc to cancel."}
                      </div>
                    </>
                  )}
                </div>
                <a
                  href={`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${fixingProject.lat},${fixingProject.lng}`}
                  target="_blank"
                  rel="noreferrer"
                  className="bg-white/15 border border-white/40 rounded px-3 py-1.5 text-xs whitespace-nowrap hover:bg-white/25"
                >
                  Street View ↗
                </a>
                {!pendingPick && fixingFlag?.suggestedLat != null && (
                  <button
                    onClick={snapToBook}
                    className="bg-white/15 border border-white/40 rounded px-3 py-1.5 text-xs whitespace-nowrap hover:bg-white/25"
                    title="Move placement to the Hoboken address-book location"
                  >
                    Use book location
                  </button>
                )}
                {pendingPick && (
                  <button
                    onClick={savePlacement}
                    disabled={savingPick}
                    className="disabled:opacity-50 bg-white text-[#0f4f8a] font-semibold rounded px-3 py-1.5 text-xs whitespace-nowrap"
                  >
                    {savingPick ? "Saving…" : "Save placement"}
                  </button>
                )}
                <button
                  onClick={cancelFix}
                  className="border border-white/60 rounded px-3 py-1.5 text-xs whitespace-nowrap hover:bg-white/10"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
          <HobokenMap
            projects={geocoded}
            height="calc(100vh - 110px)"
            editMode={fixingId != null}
            onBuildingPick={handleBuildingPick}
            flyTo={flyTarget}
            previewPick={pendingPick}
            showLotNumbers
          />
        </section>
      </div>
    </main>
  );
}
