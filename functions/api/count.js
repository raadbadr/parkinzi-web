// GET /api/count?table=profiles&before=2026-04-07T23:59:59.999Z
const ALLOWED_TABLES = ["profiles", "facilities", "parking_spots", "user_cars"];

function headers(extra) {
  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "https://parkinzi.com",
    ...extra,
  };
}

export async function onRequestGet(context) {
  const { env, request } = context;
  const url = new URL(request.url);
  const table = url.searchParams.get("table");
  const before = url.searchParams.get("before");

  if (!table || !ALLOWED_TABLES.includes(table)) {
    return new Response(JSON.stringify({ error: "invalid table" }), {
      status: 400,
      headers: headers(),
    });
  }

  let endpoint = `${env.SUPABASE_URL}/rest/v1/${table}?select=id`;
  if (before) {
    endpoint += `&created_at=lte.${before}`;
  }

  const res = await fetch(endpoint, {
    headers: {
      apikey: env.SUPABASE_ANON_KEY,
      Authorization: `Bearer ${env.SUPABASE_ANON_KEY}`,
      Prefer: "count=exact",
      Range: "0-0",
    },
  });

  if (!res.ok) {
    return new Response(JSON.stringify({ count: null }), { headers: headers() });
  }

  const cr = res.headers.get("content-range");
  let count = null;
  if (cr) {
    const last = cr.trim().split("/").pop();
    if (last && last !== "*") {
      const n = Number(last);
      if (Number.isFinite(n)) count = n;
    }
  }

  return new Response(JSON.stringify({ count }), { headers: headers() });
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
