const API = "https://api.github.com";

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
  });
}

// Constant-time comparison when Web Crypto is available.
async function isAuthorized(req) {
  const expected = process.env.EDITOR_PASSWORD;
  const auth = req.headers.get("authorization") || "";
  if (!expected || !auth.startsWith("Bearer ")) return false;
  const supplied = auth.slice(7);
  if (supplied.length !== expected.length) return false;
  try {
    const a = new TextEncoder().encode(supplied);
    const b = new TextEncoder().encode(expected);
    const ah = await crypto.subtle.digest("SHA-256", a);
    const bh = await crypto.subtle.digest("SHA-256", b);
    const av = new Uint8Array(ah), bv = new Uint8Array(bh);
    let diff = 0;
    for (let i = 0; i < av.length; i++) diff |= av[i] ^ bv[i];
    return diff === 0;
  } catch { return supplied === expected; }
}

function config() {
  const { GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO, GITHUB_FILE_PATH } = process.env;
  if (!GITHUB_TOKEN || !GITHUB_OWNER || !GITHUB_REPO || !GITHUB_FILE_PATH) {
    throw new Error("Missing backend environment configuration");
  }
  return { token: GITHUB_TOKEN, owner: GITHUB_OWNER, repo: GITHUB_REPO, path: GITHUB_FILE_PATH };
}

async function githubRequest(path, token, options = {}) {
  return fetch(`${API}${path}`, {
    ...options,
    headers: {
      "Accept": "application/vnd.github+json",
      "Authorization": `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "CalendarioEscolarEditor",
      ...(options.headers || {})
    }
  });
}

export default async function handler(req) {
  if (!(await isAuthorized(req))) return json(401, { error: "Contraseña incorrecta o sesión no autorizada." });
  if (req.method !== "GET" && req.method !== "PUT") {
    return json(405, { error: "Método no permitido." });
  }

  let cfg;
  try { cfg = config(); }
  catch { return json(500, { error: "El backend no está configurado correctamente." }); }

  const path = `/repos/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}/contents/${cfg.path.split("/").map(encodeURIComponent).join("/")}`;

  if (req.method === "GET") {
    const response = await githubRequest(path, cfg.token);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return json(response.status === 404 ? 404 : 502, { error: "No se pudo leer el archivo de GitHub." });
    let content;
    try { content = atob((data.content || "").replace(/\n/g, "")); }
    catch { return json(502, { error: "GitHub devolvió un archivo que no se pudo descodificar." }); }
    // Decode UTF-8 correctly after base64.
    const bytes = Uint8Array.from(content, c => c.charCodeAt(0));
    const text = new TextDecoder("utf-8").decode(bytes);
    return json(200, { content: text, sha: data.sha, path: cfg.path });
  }

  let body;
  try { body = await req.json(); }
  catch { return json(400, { error: "JSON no válido." }); }
  if (typeof body.content !== "string" || typeof body.sha !== "string") {
    return json(400, { error: "Faltan content o sha." });
  }
  if (body.content.length > 100000) return json(413, { error: "El archivo es demasiado grande." });

  const encoded = btoa(String.fromCharCode(...new TextEncoder().encode(body.content)));
  const response = await githubRequest(path, cfg.token, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: "Actualizar calendario desde la app Android",
      content: encoded,
      sha: body.sha
    })
  });
  const result = await response.json().catch(() => ({}));
  if (response.status === 409 || response.status === 422) {
    return json(409, { error: "El archivo cambió en GitHub desde que lo abriste. Recarga los datos antes de guardar." });
  }
  if (!response.ok) return json(502, { error: "GitHub no pudo guardar los cambios." });
  return json(200, { success: true, sha: result.content?.sha || "" });
}
