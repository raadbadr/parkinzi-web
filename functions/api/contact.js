// POST /api/contact   body: { subject, name, email, message }
function headers() {
  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "https://parkinzi.com",
  };
}

export async function onRequestPost(context) {
  const { env, request } = context;

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid body" }), {
      status: 400,
      headers: headers(),
    });
  }

  const { subject, name, email, message } = body || {};
  if (!name || !email || !message) {
    return new Response(JSON.stringify({ error: "missing fields" }), {
      status: 400,
      headers: headers(),
    });
  }

  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/contact_messages`, {
    method: "POST",
    headers: {
      apikey: env.SUPABASE_ANON_KEY,
      Authorization: `Bearer ${env.SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({ subject, name, email, message }),
  });

  return new Response(JSON.stringify({ ok: res.ok }), {
    status: res.status,
    headers: headers(),
  });
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "https://parkinzi.com",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
    },
  });
}
