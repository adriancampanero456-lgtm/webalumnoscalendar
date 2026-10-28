
const API = "https://api.github.com";

function json(status, body) {
  return {
    statusCode: status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    },
    body: JSON.stringify(body)
  };
}

// Comprobar la contraseña de acceso.
async function isAuthorized(req) {
  const expected = process.env.EDITOR_PASSWORD;
  const auth = req.headers.authorization || "";

  if (!expected || !auth.startsWith("Bearer ")) {
    return false;
  }

  const supplied = auth.slice(7);

  if (supplied.length !== expected.length) {
    return false;
  }

  try {
    const a = new TextEncoder().encode(supplied);
    const b = new TextEncoder().encode(expected);

    const ah = await crypto.subtle.digest("SHA-256", a);
    const bh = await crypto.subtle.digest("SHA-256", b);

    const av = new Uint8Array(ah);
    const bv = new Uint8Array(bh);

    let diff = 0;

    for (let i = 0; i < av.length; i++) {
      diff |= av[i] ^ bv[i];
    }

    return diff === 0;
  } catch {
    return supplied === expected;
  }
}

// Leer la configuración de las variables de entorno.
function config() {
  const {
    GITHUB_TOKEN,
    GITHUB_OWNER,
    GITHUB_REPO,
    GITHUB_FILE_PATH
  } = process.env;

  if (
    !GITHUB_TOKEN ||
    !GITHUB_OWNER ||
    !GITHUB_REPO ||
    !GITHUB_FILE_PATH
  ) {
    throw new Error("Missing backend environment configuration");
  }

  return {
    token: GITHUB_TOKEN,
    owner: GITHUB_OWNER,
    repo: GITHUB_REPO,
    path: GITHUB_FILE_PATH
  };
}

// Realizar peticiones a la API de GitHub.
async function githubRequest(path, token, options = {}) {
  return fetch(`${API}${path}`, {
    ...options,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "CalendarioEscolarEditor",
      ...(options.headers || {})
    }
  });
}

export default async function handler(req, res) {
  // Comprobar la autorización.
  if (!(await isAuthorized(req))) {
    return res.status(401).json({
      error: "Contraseña incorrecta o sesión no autorizada."
    });
  }

  if (req.method !== "GET" && req.method !== "PUT") {
    res.setHeader("Allow", "GET, PUT");
    return res.status(405).json({
      error: "Método no permitido."
    });
  }

  let cfg;

  try {
    cfg = config();
  } catch {
    return res.status(500).json({
      error: "El backend no está configurado correctamente."
    });
  }

  const path =
    `/repos/${encodeURIComponent(cfg.owner)}` +
    `/${encodeURIComponent(cfg.repo)}` +
    `/contents/${cfg.path
      .split("/")
      .map(encodeURIComponent)
      .join("/")}`;

  // GET: leer el calendario desde GitHub.
  if (req.method === "GET") {
    try {
      const response = await githubRequest(path, cfg.token);
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        return res
          .status(response.status === 404 ? 404 : 502)
          .json({
            error: "No se pudo leer el archivo de GitHub."
          });
      }

      let binary;

      try {
        binary = atob((data.content || "").replace(/\n/g, ""));
      } catch {
        return res.status(502).json({
          error: "GitHub devolvió un archivo que no se pudo descodificar."
        });
      }

      const bytes = Uint8Array.from(
        binary,
        character => character.charCodeAt(0)
      );

      const content = new TextDecoder("utf-8").decode(bytes);

      return res.status(200).json({
        content,
        sha: data.sha,
        path: cfg.path
      });
    } catch {
      return res.status(502).json({
        error: "Error al conectar con GitHub."
      });
    }
  }

  // PUT: recibir los cambios de la aplicación Android.
  let body;

  try {
    body =
      typeof req.body === "string"
        ? JSON.parse(req.body)
        : req.body;
  } catch {
    return res.status(400).json({
      error: "JSON no válido."
    });
  }

  if (
    !body ||
    typeof body.content !== "string" ||
    typeof body.sha !== "string"
  ) {
    return res.status(400).json({
      error: "Faltan content o sha."
    });
  }

  if (body.content.length > 100000) {
    return res.status(413).json({
      error: "El archivo es demasiado grande."
    });
  }

  try {
    const bytes = new TextEncoder().encode(body.content);

    let binary = "";

    for (let i = 0; i < bytes.length; i += 8192) {
      binary += String.fromCharCode(
        ...bytes.subarray(i, i + 8192)
      );
    }

    const encoded = btoa(binary);

    const response = await githubRequest(path, cfg.token, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: "Actualizar calendario desde la app Android",
        content: encoded,
        sha: body.sha
      })
    });

    const result = await response.json().catch(() => ({}));

    if (response.status === 409 || response.status === 422) {
      return res.status(409).json({
        error:
          "El archivo cambió en GitHub desde que lo abriste. " +
          "Recarga los datos antes de guardar."
      });
    }

    if (!response.ok) {
      return res.status(502).json({
        error: "GitHub no pudo guardar los cambios."
      });
    }

    return res.status(200).json({
      success: true,
      sha: result.content?.sha || ""
    });
  } catch {
    return res.status(502).json({
      error: "Error al conectar con GitHub para guardar los cambios."
    });
  }
}
