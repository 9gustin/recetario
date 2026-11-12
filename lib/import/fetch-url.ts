import "server-only";
import dns from "node:dns";
import http from "node:http";
import https from "node:https";
import net from "node:net";

/** ¿La IP es privada, de loopback, link-local o reservada? (no se puede pedir desde el servidor) */
export function isPrivateAddress(ip: string): boolean {
  const family = net.isIP(ip);
  if (family === 4) {
    const [a = 0, b = 0, c = 0] = ip.split(".").map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) || // CGNAT
      (a === 169 && b === 254) || // link-local / metadata de la nube
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0 && c === 0) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224 // multicast y reservadas
    );
  }
  if (family === 6) {
    const lower = ip.toLowerCase();
    const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateAddress(mapped[1]!);
    return (
      lower === "::" ||
      lower === "::1" ||
      lower.startsWith("fc") ||
      lower.startsWith("fd") || // unique local
      /^fe[89ab]/.test(lower) || // link-local
      lower.startsWith("ff") // multicast
    );
  }
  return true; // si no es una IP válida, no se confía
}

export type FetchUrlOptions = {
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
  /** Solo para tests con un servidor local. */
  allowPrivate?: boolean;
};

export type FetchUrlResult =
  { ok: true; html: string; finalUrl: string } | { ok: false; error: string };

const USER_AGENT = "Mozilla/5.0 (compatible; RecetarioBot/1.0; importador de recetas)";

class FetchError extends Error {}

function requestOnce(
  url: URL,
  opts: Required<FetchUrlOptions>,
): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: Buffer }> {
  return new Promise((resolve, reject) => {
    const lib = url.protocol === "https:" ? https : http;
    // El `lookup` valida la IP a la que realmente se conecta (evita DNS rebinding).
    const lookup: net.LookupFunction = (hostname, options, callback) => {
      dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
        if (err) return callback(err, "", 4);
        const list = addresses as dns.LookupAddress[];
        if (!opts.allowPrivate && list.some((a) => isPrivateAddress(a.address))) {
          return callback(new FetchError("Dirección no permitida"), "", 4);
        }
        const first = list[0];
        if (!first) return callback(new FetchError("No se pudo resolver el sitio"), "", 4);
        if ((options as { all?: boolean }).all) {
          return (callback as unknown as (e: null, a: dns.LookupAddress[]) => void)(null, list);
        }
        callback(null, first.address, first.family);
      });
    };

    const req = lib.request(
      url,
      {
        method: "GET",
        lookup,
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "text/html,application/xhtml+xml",
          "Accept-Encoding": "identity",
          "Accept-Language": "es-AR,es;q=0.9,en;q=0.5",
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        let size = 0;
        let tooBig = false;
        res.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > opts.maxBytes) {
            tooBig = true;
            reject(new FetchError("La página es demasiado grande"));
            req.destroy();
            return;
          }
          chunks.push(chunk);
        });
        res.on("end", () => {
          if (tooBig) return; // ya se rechazó
          resolve({
            status: res.statusCode ?? 0,
            headers: res.headers,
            body: Buffer.concat(chunks),
          });
        });
        res.on("error", reject);
      },
    );
    req.setTimeout(opts.timeoutMs, () =>
      req.destroy(new FetchError("El sitio tardó demasiado en responder")),
    );
    req.on("error", reject);
    req.end();
  });
}

/** Descarga el HTML de una página (http/https) con protección SSRF, timeout y tope de tamaño. */
export async function fetchUrl(
  rawUrl: string,
  options: FetchUrlOptions = {},
): Promise<FetchUrlResult> {
  const opts: Required<FetchUrlOptions> = {
    timeoutMs: 10_000,
    maxBytes: 3 * 1024 * 1024,
    maxRedirects: 3,
    allowPrivate: false,
    ...options,
  };

  try {
    let url = new URL(rawUrl.trim());
    for (let hop = 0; hop <= opts.maxRedirects; hop++) {
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        return { ok: false, error: "El link tiene que empezar con http:// o https://" };
      }
      const host = url.hostname.replace(/^\[|\]$/g, "");
      if (
        !opts.allowPrivate &&
        (host === "localhost" || (net.isIP(host) && isPrivateAddress(host)))
      ) {
        return { ok: false, error: "No se puede abrir ese link." };
      }

      const res = await requestOnce(url, opts);
      if ([301, 302, 303, 307, 308].includes(res.status) && res.headers.location) {
        url = new URL(res.headers.location, url);
        continue;
      }
      if (res.status < 200 || res.status >= 300) {
        return { ok: false, error: `El sitio respondió con un error (${res.status}).` };
      }
      const type = String(res.headers["content-type"] ?? "");
      if (type && !/html|xml|text\//i.test(type)) {
        return { ok: false, error: "Ese link no es una página web." };
      }
      const charset = type.match(/charset=([\w-]+)/i)?.[1] ?? "utf-8";
      let html: string;
      try {
        html = new TextDecoder(charset).decode(res.body);
      } catch {
        html = new TextDecoder("utf-8").decode(res.body);
      }
      return { ok: true, html, finalUrl: url.toString() };
    }
    return { ok: false, error: "El link redirige demasiadas veces." };
  } catch (e) {
    if (e instanceof FetchError) return { ok: false, error: e.message };
    if (e instanceof TypeError) return { ok: false, error: "El link no es válido." };
    const message = e instanceof Error ? e.message : "";
    if (/Dirección no permitida/.test(message))
      return { ok: false, error: "No se puede abrir ese link." };
    return { ok: false, error: "No pudimos abrir ese link." };
  }
}
