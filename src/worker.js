/**
 * PARKINZI API Worker — proxies Supabase calls server-side.
 * Keys are read from environment variables (Secrets in Cloudflare Dashboard).
 * Static assets are served by the [assets] binding automatically.
 */

import { handleMcpRequest, mcpDiscoveryDocument } from "./mcp.js";

// Android App Links — Digital Asset Links statement for parkinzi.com.
// Cloudflare's static-assets binding skips files under a dot-folder, so we
// serve this directly from the Worker to guarantee Google's verifier can
// reach https://parkinzi.com/.well-known/assetlinks.json with the right
// Content-Type and no redirects.
const ASSETLINKS_JSON = JSON.stringify([
  {
    relation: ["delegate_permission/common.handle_all_urls"],
    target: {
      namespace: "android_app",
      package_name: "com.parkinzi.android",
      sha256_cert_fingerprints: [
        "D1:86:1C:2F:71:23:DC:43:2A:14:D6:55:4E:15:12:6B:8A:D1:2A:CA:F7:2E:F5:ED:84:94:6C:65:C2:5B:03:EA",
      ],
    },
  },
]);

const ALLOWED_TABLES = ["profiles", "facilities", "parking_spots", "user_cars"];
// Public columns ONLY. Owner identity (owner_name, owner_profile_number),
// legal documents (location_deed_number, location_commercial_register),
// and infrastructure details (camera_url, detection_ip) must never be
// selectable through the public API.
const PUBLIC_SPOT_COLUMNS =
  "id,spot_location,spot_code,spot_number,spot_type,spot_size,spot_status," +
  "latitude,longitude,has_electric_charger,charger_power_kw,supported_fuel_type," +
  "spot_price_per_hour,spot_price_per_day,spot_discount_percentage," +
  "average_rating,total_ratings,national_address,created_at";
const ALLOWED_COLUMNS = [
  // "*" intentionally NOT allowed — it leaked owner names, deed numbers,
  // camera URLs, and detection IPs. handleParkingSpots maps "*" to
  // PUBLIC_SPOT_COLUMNS instead, so old clients keep working safely.
  "id", "latitude", "longitude", "name", "facility_id",
  "has_electric_charger", "created_at", "spot_number", "floor",
  "spot_type", "ev_charger_type", "is_available",
  "spot_name", "national_address", "area_name", "spot_count", "spots",
  "lat", "lng", "metadata", "label",
  // Real schema additions
  "spot_location", "spot_code", "spot_size", "spot_status",
  "charger_power_kw", "supported_fuel_type",
  "spot_price_per_hour", "spot_price_per_day", "spot_discount_percentage",
  "average_rating", "total_ratings",
];

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
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

// Cloudflare Workers cache fetch() responses by default at the edge.
// Pass this to every Supabase call so the worker always asks Supabase
// directly and never serves a stale cached count.
const NO_CACHE = { cacheTtl: 0, cacheEverything: false };

async function handleCount(url, env) {
  const table = url.searchParams.get("table");
  const before = url.searchParams.get("before");
  if (!table || !ALLOWED_TABLES.includes(table)) return json({ error: "invalid table" }, 400);

  let endpoint = `${env.SUPABASE_URL}/rest/v1/${table}?select=id`;
  if (before) endpoint += `&created_at=lte.${before}`;

  const res = await fetch(endpoint, {
    headers: { ...supaHeaders(env), Prefer: "count=exact", Range: "0-0" },
    cf: NO_CACHE,
  });
  return json({ count: res.ok ? parseCount(res) : null });
}

async function handleChargerCount(url, env) {
  const before = url.searchParams.get("before");
  let endpoint = `${env.SUPABASE_URL}/rest/v1/parking_spots?select=id&has_electric_charger=eq.true`;
  if (before) endpoint += `&created_at=lte.${before}`;

  const res = await fetch(endpoint, {
    headers: { ...supaHeaders(env), Prefer: "count=exact", Range: "0-0" },
    cf: NO_CACHE,
  });
  return json({ count: res.ok ? parseCount(res) : null });
}

async function handleFuelStats(env) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/get_fuel_type_stats`, {
    method: "POST",
    headers: { ...supaHeaders(env), Accept: "application/json", "Content-Type": "application/json" },
    body: "{}",
    cf: NO_CACHE,
  });
  return json(res.ok ? await res.json() : []);
}

async function handleParkingSpots(url, env) {
  let select = url.searchParams.get("select") || "*";
  // "*" used to pass straight through and exposed every column, including
  // owner identity, deed numbers, camera URLs, and detection IPs. Map it to
  // the public column list — same callers, sanitized payload.
  if (select.trim() === "*") {
    select = PUBLIC_SPOT_COLUMNS;
  } else {
    const cols = select.split(",").map((c) => c.trim());
    if (!cols.every((c) => ALLOWED_COLUMNS.includes(c))) return json({ error: "invalid columns" }, 400);
  }

  const endpoint = `${env.SUPABASE_URL}/rest/v1/parking_spots?select=${encodeURIComponent(select)}`;
  const res = await fetch(endpoint, {
    headers: { ...supaHeaders(env), Accept: "application/json" },
    cf: NO_CACHE,
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

    // Android App Links — must serve from the Worker because the assets
    // binding strips dotfile folders. Google's verifier expects
    // Content-Type: application/json and no redirects.
    if (path === "/.well-known/assetlinks.json") {
      return new Response(ASSETLINKS_JSON, {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "public, max-age=300",
        },
      });
    }

    // MCP Server — read-only access for AI assistants (Claude, ChatGPT, etc.)
    if (path === "/mcp") {
      return handleMcpRequest(request, env);
    }

    // MCP Registry domain verification (HTTP method). The registry's
    // mcp-publisher CLI checks this when we publish under com.parkinzi/*.
    // Public key only — the private seed lives outside the repo.
    if (path === "/.well-known/mcp-registry-auth") {
      return new Response(
        "v=MCPv1; k=ed25519; p=T/Re6kkxh2i3M0SEFF97seIxQHpXMe8sdW3wwnft/Cc=",
        {
          headers: {
            "Content-Type": "text/plain",
            "Cache-Control": "public, max-age=300",
          },
        }
      );
    }

    // MCP discovery manifest. Served from the Worker so it's never cached
    // behind a stale assets build.
    if (path === "/.well-known/mcp.json") {
      return new Response(JSON.stringify(mcpDiscoveryDocument(), null, 2), {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "public, max-age=300",
        },
      });
    }

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
