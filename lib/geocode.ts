// Free geocoding via OpenStreetMap Nominatim.
// Rate-limited to 1 req/sec by their policy. We add a small delay
// between calls in bulk scripts. Always include a descriptive User-Agent.

export type GeoResult = { lat: number; lng: number };

export async function geocodeAddress(rawAddress: string): Promise<GeoResult | null> {
  const address = rawAddress.trim();
  if (!address) return null;

  // Bias the query to Hoboken if no city/state is present.
  const needsCity = !/hoboken/i.test(address);
  const query = needsCity ? `${address}, Hoboken, NJ` : address;

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  url.searchParams.set("q", query);
  url.searchParams.set("countrycodes", "us");

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "CapitolRoofingHobokenMap/1.0 (admin@capitolroofingnj.com)",
        Accept: "application/json",
      },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Array<{ lat: string; lon: string }>;
    if (!data.length) return null;
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch {
    return null;
  }
}
