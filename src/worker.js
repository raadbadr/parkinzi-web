/**
 * PARKINZI API Worker — proxies Supabase calls server-side.
 * Keys are read from environment variables (Secrets in Cloudflare Dashboard).
 * Static assets are served by the [assets] binding automatically.
 */

const ALLOWED_TABLES = ["profiles", "facilities", "parking_spots", "user_cars"];
const ALLOWED_COLUMNS = [
  "*", "id", "latitude", "longitude", "name", "facility_id",
  "has_electric_charger", "created_at", "spot_number", "floor",
  "spot_type", "ev_charger_type", "is_available",
  "spot_name", "national_address", "area_name", "spot_count", "spots",
  "lat", "lng", "metadata", "label",
];

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function supaHeaders(env) {
  return {
    apikey: env.SUPABASE_ANON_KEY,
    Authorization: `Bearer ${env.SUPABASE_ANON_KEY}`,
  };
}

function parseCount(res) {
  const cr = res.headers.get("content-range");
  if (!cr) return null;
  const last = cr.trim().split("/").pop();
  if (!last || last === "*") return null;
  const n = Number(last);
  return Number.isFinite(n) ? n : null;
}

// --- Route handlers ---

async function handleCount(url, env) {
  const table = url.searchParams.get("table");
  const before = url.searchParams.get("before");
  if (!table || !ALLOWED_TABLES.includes(table)) return json({ error: "invalid table" }, 400);

  let endpoint = `${env.SUPABASE_URL}/rest/v1/${table}?select=id`;
  if (before) endpoint += `&created_at=lte.${before}`;

  const res = await fetch(endpoint, {
    headers: { ...supaHeaders(env), Prefer: "count=exact", Range: "0-0" },
  });
  return json({ count: res.ok ? parseCount(res) : null });
}

async function handleChargerCount(url, env) {
  const before = url.searchParams.get("before");
  let endpoint = `${env.SUPABASE_URL}/rest/v1/parking_spots?select=id&has_electric_charger=eq.true`;
  if (before) endpoint += `&created_at=lte.${before}`;

  const res = await fetch(endpoint, {
    headers: { ...supaHeaders(env), Prefer: "count=exact", Range: "0-0" },
  });
  return json({ count: res.ok ? parseCount(res) : null });
}

async function handleFuelStats(env) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/get_fuel_type_stats`, {
    method: "POST",
    headers: { ...supaHeaders(env), Accept: "application/json", "Content-Type": "application/json" },
    body: "{}",
  });
  return json(res.ok ? await res.json() : []);
}

async function handleParkingSpots(url, env) {
  const select = url.searchParams.get("select") || "*";
  const cols = select.split(",").map((c) => c.trim());
  if (!cols.every((c) => ALLOWED_COLUMNS.includes(c))) return json({ error: "invalid columns" }, 400);

  const endpoint = `${env.SUPABASE_URL}/rest/v1/parking_spots?select=${encodeURIComponent(select)}`;
  const res = await fetch(endpoint, {
    headers: { ...supaHeaders(env), Accept: "application/json" },
  });
  return json(res.ok ? await res.json() : []);
}

async function handleWaitlist(request, env) {
  let body;
  try { body = await request.json(); } catch { return json({ error: "invalid body" }, 400); }
  const email = (body.email || "").trim().toLowerCase();
  if (!email || !email.includes("@")) return json({ error: "invalid email" }, 400);

  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/waitlist`, {
    method: "POST",
    headers: { ...supaHeaders(env), "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({ email }),
  });
  return json({ ok: res.ok }, res.status);
}

async function handleContact(request, env) {
  let body;
  try { body = await request.json(); } catch { return json({ error: "invalid body" }, 400); }
  const { subject, name, email, message } = body || {};
  if (!name || !email || !message) return json({ error: "missing fields" }, 400);

  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/contact_messages`, {
    method: "POST",
    headers: { ...supaHeaders(env), "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({ subject, name, email, message }),
  });
  return json({ ok: res.ok }, res.status);
}

// --- Main router ---

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Only handle /api/* routes — everything else is static assets
    if (!path.startsWith("/api/")) return env.ASSETS.fetch(request);

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    try {
      if (path === "/api/count" && request.method === "GET") return await handleCount(url, env);
      if (path === "/api/charger-count" && request.method === "GET") return await handleChargerCount(url, env);
      if (path === "/api/fuel-stats" && request.method === "GET") return await handleFuelStats(env);
      if (path === "/api/parking-spots" && request.method === "GET") return await handleParkingSpots(url, env);
      if (path === "/api/waitlist" && request.method === "POST") return await handleWaitlist(request, env);
      if (path === "/api/contact" && request.method === "POST") return await handleContact(request, env);
      return json({ error: "not found" }, 404);
    } catch (err) {
      return json({ error: "server error" }, 500);
    }
  },
};
