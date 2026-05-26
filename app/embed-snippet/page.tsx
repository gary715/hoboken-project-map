export default function EmbedSnippetPage() {
  const snippet = `<iframe
  src="https://YOUR-DOMAIN.com/map"
  width="100%"
  height="600"
  style="border:0;border-radius:8px;"
  loading="lazy"
  title="Capitol Roofing — Hoboken Projects">
</iframe>`;

  return (
    <main className="max-w-3xl mx-auto p-8 space-y-4">
      <h1 className="text-2xl font-bold">Embed snippet</h1>
      <p className="text-sm text-gray-600">
        Paste this on any page of your website. Replace <code>YOUR-DOMAIN.com</code> with the
        domain where this app is hosted.
      </p>
      <pre className="bg-gray-900 text-gray-100 rounded p-4 text-xs overflow-auto">{snippet}</pre>
      <h2 className="text-lg font-semibold pt-4">Preview</h2>
      <iframe
        src="/map"
        width="100%"
        height="500"
        style={{ border: 0, borderRadius: 8 }}
        title="Map preview"
      />
    </main>
  );
}
