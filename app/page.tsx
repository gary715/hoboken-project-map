"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";

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
  created_at: string;
};

export default function AdminPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [filter, setFilter] = useState("");
  const [form, setForm] = useState({
    address: "",
    project_type: "Full Roof",
    completed_date: "",
    notes: "",
  });

  async function refresh() {
    setLoading(true);
    const res = await fetch("/api/projects", { cache: "no-store" });
    setProjects(await res.json());
    setLoading(false);
  }

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
    setForm({ ...form, address: "", notes: "" });
    setAdding(false);
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
      projects.filter((p) =>
        p.address.toLowerCase().includes(filter.toLowerCase())
      ),
    [projects, filter]
  );

  const geocoded = projects.filter((p) => p.lat != null);
  const ungeocoded = projects.filter((p) => p.lat == null);

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-red-700 text-white px-6 py-4 shadow">
        <h1 className="text-xl font-bold">Capitol Roofing — Hoboken Project Map Admin</h1>
        <p className="text-sm opacity-90">
          {projects.length} projects · {geocoded.length} mapped · {ungeocoded.length} need geocoding ·{" "}
          <a className="underline" href="/map" target="_blank">
            Open public map ↗
          </a>{" "}
          ·{" "}
          <a className="underline" href="/embed-snippet" target="_blank">
            Embed code
          </a>
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-4 p-4">
        <section className="bg-white rounded shadow p-4 space-y-4">
          <form onSubmit={addProject} className="space-y-3">
            <h2 className="font-semibold">Add project</h2>
            <input
              className="w-full border rounded px-2 py-1.5 text-sm"
              placeholder="123 Main Street"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              required
            />
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
              className="bg-red-700 hover:bg-red-800 disabled:opacity-50 text-white text-sm rounded px-3 py-1.5"
            >
              {adding ? "Adding & geocoding…" : "Add project"}
            </button>
          </form>

          <div>
            <input
              className="w-full border rounded px-2 py-1.5 text-sm mb-2"
              placeholder="Filter by address…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
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
                    <tr key={p.id} className="border-t hover:bg-gray-50">
                      <td className="px-2 py-1">{p.address}</td>
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
                      <td className="px-2 py-1 text-right">
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

        <section className="bg-white rounded shadow overflow-hidden">
          <HobokenMap projects={geocoded} height="calc(100vh - 110px)" />
        </section>
      </div>
    </main>
  );
}
