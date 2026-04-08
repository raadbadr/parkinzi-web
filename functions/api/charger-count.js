// GET /api/charger-count?before=2026-04-07T23:59:59.999Z
function headers() {
  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "https://parkinzi.com",
  };
}

export async function onRequestGet(context) {
  const { env, request } = context;
  const url = new URL(request.url);
  const before = url.searchParams.get("before");

  let endpoint = `${env.SUPABASE_URL}/rest/v1/parking_spots?select=id&has_electric_charger=eq.true`;
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
