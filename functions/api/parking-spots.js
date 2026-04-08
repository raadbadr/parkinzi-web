// GET /api/parking-spots?select=id,latitude,longitude,...
const ALLOWED_COLUMNS = [
  "*", "id", "latitude", "longitude", "name", "facility_id",
  "has_electric_charger", "created_at", "spot_number", "floor",
  "spot_type", "ev_charger_type", "is_available",
];

function headers() {
  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "https://parkinzi.com",
  };
}

export async function onRequestGet(context) {
  const { env, request } = context;
  const url = new URL(request.url);
  const select = url.searchParams.get("select") || "*";

  // Validate columns
  const cols = select.split(",").map((c) => c.trim());
  if (!cols.every((c) => ALLOWED_COLUMNS.includes(c))) {
    return new Response(JSON.stringify({ error: "invalid columns" }), {
      status: 400,
      headers: headers(),
    });
  }

  const endpoint = `${env.SUPABASE_URL}/rest/v1/parking_spots?select=${encodeURIComponent(select)}`;
  const res = await fetch(endpoint, {
    headers: {
      apikey: env.SUPABASE_ANON_KEY,
      Authorization: `Bearer ${env.SUPABASE_ANON_KEY}`,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    return new Response(JSON.stringify([]), { headers: headers() });
  }

  const data = await res.json();
  return new Response(JSON.stringify(data), { headers: headers() });
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "https://parkinzi.com",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Max-Age": "86400",
    },
  });
}
