const json = (d, s = 200) =>
  new Response(JSON.stringify(d), {
    status: s,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const m = url.pathname.match(/^\/api\/projects(?:\/([\w-]{1,60}))?\/?$/);
    if (!m) return json({ error: "not found" }, 404);
    const id = m[1];
    try {
      if (req.method === "GET" && !id) {
        const { results } = await env.DB.prepare(
          "SELECT id, name, data FROM projects ORDER BY updated_at DESC LIMIT 100"
        ).all();
        return json(results.map(r => ({ id: r.id, name: r.name, ...JSON.parse(r.data) })));
      }
      if (req.method === "PUT" && id) {
        const text = await req.text();
        if (text.length > 20000) return json({ error: "too large" }, 413);
        const b = JSON.parse(text);
        if (!b.data || !Array.isArray(b.data.parts)) return json({ error: "bad data" }, 400);
        const name = String(b.name || "Untitled").slice(0, 40);
        await env.DB.prepare(
          "INSERT INTO projects (id, name, data, updated_at) VALUES (?1, ?2, ?3, ?4) " +
          "ON CONFLICT(id) DO UPDATE SET name = ?2, data = ?3, updated_at = ?4"
        ).bind(id, name, JSON.stringify(b.data), Date.now()).run();
        return json({ ok: true });
      }
      if (req.method === "DELETE" && id) {
        await env.DB.prepare("DELETE FROM projects WHERE id = ?1").bind(id).run();
        return new Response(null, { status: 204 });
      }
      return json({ error: "method not allowed" }, 405);
    } catch (e) {
      return json({ error: "server error" }, 500);
    }
  },
};
