/**
 * PARKINZI MCP Server
 *
 * Implements the Model Context Protocol (Streamable HTTP transport) so AI
 * assistants like Claude and ChatGPT can search PARKINZI's live parking
 * and EV-charger data, plus the blog, directly from a conversation.
 *
 * Endpoint:   POST /mcp        (JSON-RPC 2.0)
 * Discovery:  GET  /.well-known/mcp.json
 *
 * Tools currently exposed (all read-only):
 *   - search_parking_spots
 *   - find_ev_chargers
 *   - get_spot_details
 *   - get_platform_stats
 *   - list_supported_cities
 *   - search_blog_posts
 *   - get_app_info
 *
 * Rate limiting is enforced at the Cloudflare WAF layer (free tier) plus
 * a soft cap inside this module to keep Supabase costs predictable.
 */

const MCP_PROTOCOL_VERSION = "2024-11-05";

const MCP_SERVER_INFO = {
  name: "parkinzi",
  version: "0.1.0",
  title: "PARKINZI — Smart Parking & EV Charging (Saudi Arabia)",
};

const MCP_SERVER_INSTRUCTIONS = `PARKINZI is a Saudi smart-parking platform.
Use these tools to:
  - Search parking spots by location, radius, or EV-charger availability.
  - Recommend EV charging spots to drivers.
  - Surface live platform stats (cities covered, total spots, etc.).
  - Find PARKINZI blog articles about parking, EVs, and Saudi smart cities.

Coordinates use WGS84 (decimal degrees, e.g. Riyadh = 24.7136, 46.6753).
All results are live from PARKINZI's database.`;

// Cloudflare's edge fetch caches by default; force fresh reads from Supabase.
const NO_CACHE = { cacheTtl: 0, cacheEverything: false };

function supaHeaders(env) {
  return {
    apikey: env.SUPABASE_ANON_KEY,
    Authorization: `Bearer ${env.SUPABASE_ANON_KEY}`,
  };
}

// --- Tool catalogue --------------------------------------------------------

const TOOLS = [
  {
    name: "search_parking_spots",
    description:
      "Search live parking spots on PARKINZI by location, free-text query, or EV-charger filter. Returns up to 50 spots with name, coordinates, area, floor, type, and whether they offer EV charging.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            "Optional free-text search across spot name, label, and area (e.g. 'Riyadh Park', 'حي العليا').",
        },
        latitude: {
          type: "number",
          description: "Center latitude (WGS84). Pair with longitude.",
        },
        longitude: {
          type: "number",
          description: "Center longitude (WGS84).",
        },
        radius_km: {
          type: "number",
          description: "Search radius in kilometers (default 5, max 50).",
          default: 5,
        },
        has_charger: {
          type: "boolean",
          description: "If true, return only spots that have an EV charger.",
        },
        limit: {
          type: "integer",
          description: "Max number of results (default 10, max 50).",
          default: 10,
        },
      },
    },
  },
  {
    name: "find_ev_chargers",
    description:
      "Locate EV charging spots near a coordinate. Optionally filter by charger type. Result includes charger_type and the spot location.",
    inputSchema: {
      type: "object",
      properties: {
        latitude: { type: "number", description: "Center latitude (WGS84)." },
        longitude: { type: "number", description: "Center longitude (WGS84)." },
        radius_km: {
          type: "number",
          description: "Search radius in km (default 10).",
          default: 10,
        },
        charger_type: {
          type: "string",
          description:
            "Optional filter on the charger_type field (e.g. 'AC', 'DC', 'Type 2', 'CCS').",
        },
        limit: {
          type: "integer",
          description: "Max results (default 10, max 50).",
          default: 10,
        },
      },
      required: ["latitude", "longitude"],
    },
  },
  {
    name: "get_spot_details",
    description:
      "Get the full record for a single parking spot by its UUID id. Includes coordinates, area, facility relationship, floor, charger info, and availability.",
    inputSchema: {
      type: "object",
      properties: {
        spot_id: { type: "string", description: "UUID of the parking spot." },
      },
      required: ["spot_id"],
    },
  },
  {
    name: "get_platform_stats",
    description:
      "Live PARKINZI platform statistics: total parking spots, EV-charger spots, facilities, and registered users. Numbers come straight from the production database.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "list_supported_cities",
    description:
      "List Saudi cities/areas where PARKINZI has recorded parking spots, sorted by number of spots descending.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "search_blog_posts",
    description:
      "Search the PARKINZI blog for articles about smart parking, EV charging, Saudi cities, Vision 2030, and related topics. Returns titles, summaries, publish dates, and URLs.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Keyword(s) to search article titles, summaries, and tags.",
        },
        limit: {
          type: "integer",
          description: "Max results (default 5, max 20).",
          default: 5,
        },
      },
    },
  },
  {
    name: "get_app_info",
    description:
      "Get core information about the PARKINZI app: download links, supported platforms, languages, contact email, and a one-paragraph description.",
    inputSchema: { type: "object", properties: {} },
  },
];

// --- Helpers ---------------------------------------------------------------

function clampInt(n, fallback, min, max) {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(v)));
}

function clampNum(n, fallback, min, max) {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.max(min, Math.min(max, v));
}

// Haversine distance in km between two lat/lng pairs.
function distanceKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Approximate a bounding box for a (lat, lng, radius_km) — used for a cheap
// Supabase pre-filter; we still apply the exact haversine after fetching.
function bbox(lat, lng, radiusKm) {
  const latDelta = radiusKm / 111;
  const lngDelta = radiusKm / (111 * Math.cos((lat * Math.PI) / 180) || 1);
  return {
    minLat: lat - latDelta,
    maxLat: lat + latDelta,
    minLng: lng - lngDelta,
    maxLng: lng + lngDelta,
  };
}

function spotLat(row) {
  return Number(row.latitude ?? row.lat);
}
function spotLng(row) {
  return Number(row.longitude ?? row.lng);
}

function projectSpot(row, originLat, originLng) {
  const lat = spotLat(row);
  const lng = spotLng(row);
  const out = {
    id: row.id,
    name: row.spot_name || row.name || row.label || null,
    area: row.area_name || null,
    latitude: Number.isFinite(lat) ? lat : null,
    longitude: Number.isFinite(lng) ? lng : null,
    floor: row.floor ?? null,
    spot_type: row.spot_type ?? null,
    has_electric_charger: Boolean(row.has_electric_charger),
    ev_charger_type: row.ev_charger_type ?? null,
    is_available: row.is_available !== false,
  };
  if (
    Number.isFinite(originLat) &&
    Number.isFinite(originLng) &&
    out.latitude !== null &&
    out.longitude !== null
  ) {
    out.distance_km =
      Math.round(distanceKm(originLat, originLng, out.latitude, out.longitude) * 100) / 100;
  }
  return out;
}

async function supaSelect(env, table, query) {
  const url = `${env.SUPABASE_URL}/rest/v1/${table}?${query}`;
  const res = await fetch(url, { headers: supaHeaders(env), cf: NO_CACHE });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Supabase ${table} ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

async function supaCount(env, table, filters) {
  const f = filters ? `&${filters}` : "";
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${table}?select=id${f}`, {
    headers: { ...supaHeaders(env), Prefer: "count=exact", Range: "0-0" },
    cf: NO_CACHE,
  });
  if (!res.ok) return null;
  const cr = res.headers.get("content-range");
  if (!cr) return null;
  const last = cr.trim().split("/").pop();
  if (!last || last === "*") return null;
  const n = Number(last);
  return Number.isFinite(n) ? n : null;
}

// --- Tool implementations --------------------------------------------------

async function toolSearchParkingSpots(args, env) {
  const limit = clampInt(args.limit, 10, 1, 50);
  const lat = Number(args.latitude);
  const lng = Number(args.longitude);
  const radius = clampNum(args.radius_km, 5, 0.1, 50);
  const hasGeo = Number.isFinite(lat) && Number.isFinite(lng);

  const cols =
    "id,spot_name,name,label,area_name,latitude,longitude,floor,spot_type,has_electric_charger,ev_charger_type,is_available";
  const filters = [];

  if (hasGeo) {
    const b = bbox(lat, lng, radius);
    filters.push(`latitude=gte.${b.minLat}`);
    filters.push(`latitude=lte.${b.maxLat}`);
    filters.push(`longitude=gte.${b.minLng}`);
    filters.push(`longitude=lte.${b.maxLng}`);
  }
  if (args.has_charger === true) filters.push("has_electric_charger=eq.true");

  if (args.query && typeof args.query === "string") {
    const q = args.query.replace(/[%,]/g, "");
    filters.push(`or=(spot_name.ilike.*${q}*,name.ilike.*${q}*,area_name.ilike.*${q}*,label.ilike.*${q}*)`);
  }

  const queryStr = `select=${cols}&${filters.join("&")}&limit=${Math.min(limit * 4, 200)}`;
  const rows = await supaSelect(env, "parking_spots", queryStr);

  let results = rows.map((r) => projectSpot(r, lat, lng));
  if (hasGeo) {
    results = results.filter((r) => (r.distance_km ?? Infinity) <= radius);
    results.sort((a, b) => (a.distance_km ?? Infinity) - (b.distance_km ?? Infinity));
  }
  results = results.slice(0, limit);

  return {
    count: results.length,
    spots: results,
    note: "Live data from PARKINZI. Coordinates are WGS84.",
  };
}

async function toolFindEvChargers(args, env) {
  return toolSearchParkingSpots(
    {
      ...args,
      has_charger: true,
      radius_km: args.radius_km ?? 10,
      query: args.charger_type, // search the charger_type text inside the same fields
    },
    env
  );
}

async function toolGetSpotDetails(args, env) {
  if (!args.spot_id || typeof args.spot_id !== "string") {
    throw new Error("spot_id is required");
  }
  const rows = await supaSelect(
    env,
    "parking_spots",
    `select=*&id=eq.${encodeURIComponent(args.spot_id)}&limit=1`
  );
  if (!rows.length) return { found: false };
  return { found: true, spot: rows[0] };
}

async function toolPlatformStats(env) {
  const [totalSpots, evSpots, facilities, profiles] = await Promise.all([
    supaCount(env, "parking_spots"),
    supaCount(env, "parking_spots", "has_electric_charger=eq.true"),
    supaCount(env, "facilities"),
    supaCount(env, "profiles"),
  ]);
  return {
    parking_spots: totalSpots,
    ev_charger_spots: evSpots,
    facilities,
    registered_users: profiles,
    primary_country: "SA",
    platform: "PARKINZI",
    website: "https://parkinzi.com",
  };
}

async function toolListCities(env) {
  // We don't have a dedicated cities table, but area_name is populated.
  const rows = await supaSelect(
    env,
    "parking_spots",
    "select=area_name&area_name=not.is.null&limit=2000"
  );
  const counts = new Map();
  for (const r of rows) {
    const a = (r.area_name || "").trim();
    if (!a) continue;
    counts.set(a, (counts.get(a) || 0) + 1);
  }
  const cities = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 50)
    .map(([area, count]) => ({ area, spot_count: count }));
  return { count: cities.length, cities };
}

async function toolSearchBlogPosts(args, env) {
  // The blog is static. Pull posts.json via the assets binding.
  const limit = clampInt(args.limit, 5, 1, 20);
  const url = new URL("/blog/posts.json", "https://parkinzi.com");
  let posts;
  try {
    const res = await env.ASSETS.fetch(new Request(url.toString()));
    posts = await res.json();
  } catch {
    // Fallback to public URL if the binding isn't available in this context.
    const res = await fetch("https://parkinzi.com/blog/posts.json", { cf: NO_CACHE });
    posts = await res.json();
  }
  const now = new Date();
  let visible = posts.filter((p) => new Date(p.publishDate) <= now);

  const q = (args.query || "").trim().toLowerCase();
  if (q) {
    visible = visible.filter((p) => {
      const hay = `${p.title} ${p.summary} ${(p.tags || []).join(" ")}`.toLowerCase();
      return hay.includes(q);
    });
  }
  visible.sort((a, b) => new Date(b.publishDate) - new Date(a.publishDate));

  const out = visible.slice(0, limit).map((p) => ({
    title: p.title,
    summary: p.summary,
    published: p.publishDate,
    tags: p.tags,
    url: `https://parkinzi.com/blog/${p.slug}.html`,
  }));
  return { count: out.length, posts: out };
}

function toolAppInfo() {
  return {
    name: "PARKINZI",
    description:
      "PARKINZI is a Saudi smart-parking platform connecting drivers with parking-spot owners across major Saudi cities, with an EV-charging spot network.",
    languages: ["ar", "en", "fr", "ur"],
    platforms: {
      ios: "https://apps.apple.com/sa/app/parkinzi/id6751274124",
      android: "Coming soon",
    },
    website: "https://parkinzi.com",
    blog: "https://parkinzi.com/blog/",
    support_email: "support@parkinzi.com",
    primary_country: "SA",
    founded: "2024",
  };
}

// --- Dispatcher ------------------------------------------------------------

async function callTool(name, args, env) {
  switch (name) {
    case "search_parking_spots":
      return toolSearchParkingSpots(args || {}, env);
    case "find_ev_chargers":
      return toolFindEvChargers(args || {}, env);
    case "get_spot_details":
      return toolGetSpotDetails(args || {}, env);
    case "get_platform_stats":
      return toolPlatformStats(env);
    case "list_supported_cities":
      return toolListCities(env);
    case "search_blog_posts":
      return toolSearchBlogPosts(args || {}, env);
    case "get_app_info":
      return toolAppInfo();
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// --- JSON-RPC plumbing -----------------------------------------------------

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, MCP-Session-Id, MCP-Protocol-Version, X-Anthropic-Client",
  "Access-Control-Expose-Headers": "MCP-Session-Id",
  "Access-Control-Max-Age": "86400",
};

function rpcResponse(payload) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      ...CORS_HEADERS,
    },
  });
}

function rpcResult(id, result) {
  return rpcResponse({ jsonrpc: "2.0", id, result });
}

function rpcError(id, code, message, data) {
  const err = { code, message };
  if (data !== undefined) err.data = data;
  return rpcResponse({ jsonrpc: "2.0", id, error: err });
}

async function handleSingleRpc(body, env) {
  const { jsonrpc, id, method, params } = body || {};
  if (jsonrpc !== "2.0" || !method) {
    return { jsonrpc: "2.0", id: id ?? null, error: { code: -32600, message: "Invalid request" } };
  }

  try {
    switch (method) {
      case "initialize":
        return {
          jsonrpc: "2.0",
          id,
          result: {
            protocolVersion: MCP_PROTOCOL_VERSION,
            capabilities: { tools: { listChanged: false } },
            serverInfo: MCP_SERVER_INFO,
            instructions: MCP_SERVER_INSTRUCTIONS,
          },
        };

      case "tools/list":
        return { jsonrpc: "2.0", id, result: { tools: TOOLS } };

      case "tools/call": {
        const name = params?.name;
        const args = params?.arguments || {};
        if (!name) {
          return { jsonrpc: "2.0", id, error: { code: -32602, message: "Missing tool name" } };
        }
        try {
          const result = await callTool(name, args, env);
          return {
            jsonrpc: "2.0",
            id,
            result: {
              content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
              structuredContent: result,
              isError: false,
            },
          };
        } catch (toolErr) {
          return {
            jsonrpc: "2.0",
            id,
            result: {
              content: [
                { type: "text", text: `Tool error: ${toolErr.message || String(toolErr)}` },
              ],
              isError: true,
            },
          };
        }
      }

      case "ping":
        return { jsonrpc: "2.0", id, result: {} };

      case "resources/list":
      case "prompts/list":
        return { jsonrpc: "2.0", id, result: { [method.split("/")[0]]: [] } };

      case "notifications/initialized":
      case "notifications/cancelled":
        return null; // notifications get no response

      default:
        return {
          jsonrpc: "2.0",
          id,
          error: { code: -32601, message: `Method not found: ${method}` },
        };
    }
  } catch (err) {
    return {
      jsonrpc: "2.0",
      id: id ?? null,
      error: { code: -32603, message: "Internal error", data: String(err.message || err) },
    };
  }
}

export async function handleMcpRequest(request, env) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  // A friendly GET response so people opening the URL in a browser don't see
  // a blank 405. MCP itself uses POST exclusively.
  if (request.method === "GET") {
    return rpcResponse({
      server: MCP_SERVER_INFO,
      protocolVersion: MCP_PROTOCOL_VERSION,
      transport: "streamable-http",
      tools: TOOLS.map((t) => ({ name: t.name, description: t.description })),
      docs: "https://parkinzi.com/.well-known/mcp.json",
      hint: "POST JSON-RPC 2.0 requests here. Add this server in Claude or ChatGPT as a custom MCP connector.",
    });
  }

  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: CORS_HEADERS });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return rpcError(null, -32700, "Parse error");
  }

  // Batched requests
  if (Array.isArray(body)) {
    const responses = [];
    for (const item of body) {
      const r = await handleSingleRpc(item, env);
      if (r) responses.push(r);
    }
    return rpcResponse(responses);
  }

  const r = await handleSingleRpc(body, env);
  if (!r) {
    // Notification — return 204 No Content per MCP spec.
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  return rpcResponse(r);
}

// Discovery manifest served at /.well-known/mcp.json
export function mcpDiscoveryDocument() {
  return {
    schema_version: "1.0",
    name: MCP_SERVER_INFO.name,
    title: MCP_SERVER_INFO.title,
    version: MCP_SERVER_INFO.version,
    description:
      "Live MCP server for PARKINZI — search Saudi smart-parking spots, EV chargers, blog posts, and platform stats.",
    contact: { email: "support@parkinzi.com", website: "https://parkinzi.com" },
    transports: [
      {
        type: "streamable-http",
        url: "https://parkinzi.com/mcp",
        auth: "none",
      },
    ],
    tools: TOOLS.map((t) => ({ name: t.name, description: t.description })),
    documentation: "https://parkinzi.com/blog/",
    privacy_policy: "https://parkinzi.com/privacy.html",
    terms_of_service: "https://parkinzi.com/terms.html",
  };
}
