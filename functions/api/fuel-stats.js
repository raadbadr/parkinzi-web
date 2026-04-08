// GET /api/fuel-stats
function headers() {
  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "https://parkinzi.com",
  };
}

export async function onRequestGet(context) {
  const { env } = context;

  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/get_fuel_type_stats`, {
    method: "POST",
    headers: {
      apikey: env.SUPABASE_ANON_KEY,
      Authorization: `Bearer ${env.SUPABASE_ANON_KEY}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: "{}",
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
