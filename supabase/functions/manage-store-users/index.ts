// Gerencia subcontas. Publicar com: supabase functions deploy manage-store-users
const url = (Deno.env.get("SUPABASE_URL") || "").replace(/\/$/, "");
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization, apikey, content-type", "access-control-allow-methods": "GET, POST, PATCH, OPTIONS" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "content-type": "application/json" } });

async function service(path: string, method = "GET", body?: unknown) {
  const r = await fetch(`${url}${path}`, { method, headers: { apikey: serviceKey, authorization: `Bearer ${serviceKey}`, "content-type": "application/json", prefer: "return=representation" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = await r.json().catch(() => null);
  if (!r.ok) throw new Error(data?.message || data?.msg || `Erro ${r.status}`);
  return data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (!url || !serviceKey) return json({ error: "service_not_configured" }, 500);
  const token = req.headers.get("authorization") || "";
  const meResponse = await fetch(`${url}/auth/v1/user`, { headers: { apikey: serviceKey, authorization: token } });
  const me = await meResponse.json().catch(() => null);
  if (!meResponse.ok || !me?.id) return json({ error: "unauthorized" }, 401);
  try {
    const licenses = await service(`/rest/v1/licenses?auth_user_id=eq.${encodeURIComponent(me.id)}&select=id,max_users`);
    const license = licenses?.[0];
    if (!license) return json({ error: "only_license_owner" }, 403);
    if (req.method === "GET") {
      const members = await service(`/rest/v1/license_members?license_id=eq.${license.id}&select=id,name,email,role,active,created_at&order=created_at.asc`);
      return json({ maxUsers: license.max_users, members });
    }
    const body = await req.json();
    if (req.method === "POST") {
      const name = String(body?.name || "").trim(); const email = String(body?.email || "").trim().toLowerCase(); const password = String(body?.password || "");
      if (!name || !/^\S+@\S+\.\S+$/.test(email) || password.length < 8) return json({ error: "invalid_member" }, 400);
      const members = await service(`/rest/v1/license_members?license_id=eq.${license.id}&active=is.true&select=id`);
      if (members.length >= license.max_users) return json({ error: "seat_limit" }, 409);
      const created = await service("/auth/v1/admin/users", "POST", { email, password, email_confirm: true });
      await service("/rest/v1/license_members", "POST", { license_id: license.id, auth_user_id: created.id, name, email, role: "operator" });
      return json({ ok: true });
    }
    if (req.method === "PATCH") {
      await service(`/rest/v1/license_members?id=eq.${encodeURIComponent(String(body?.id || ""))}&license_id=eq.${license.id}`, "PATCH", { active: Boolean(body?.active) });
      return json({ ok: true });
    }
    return json({ error: "method_not_allowed" }, 405);
  } catch (e) { return json({ error: e instanceof Error ? e.message : String(e) }, 400); }
});
