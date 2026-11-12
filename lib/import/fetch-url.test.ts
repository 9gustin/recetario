import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { fetchUrl, isPrivateAddress } from "./fetch-url";

describe("isPrivateAddress", () => {
  it.each([
    "127.0.0.1",
    "10.1.2.3",
    "172.16.0.1",
    "172.31.255.255",
    "192.168.1.1",
    "169.254.169.254",
    "100.64.0.1",
    "0.0.0.0",
    "224.0.0.1",
    "::1",
    "fe80::1",
    "fc00::1",
    "fd12::1",
    "::ffff:10.0.0.1",
    "no-es-una-ip",
  ])("%s es privada", (ip) => expect(isPrivateAddress(ip)).toBe(true));

  it.each([
    "8.8.8.8",
    "1.1.1.1",
    "172.32.0.1",
    "192.169.0.1",
    "2606:4700:4700::1111",
    "::ffff:8.8.8.8",
  ])("%s es pública", (ip) => expect(isPrivateAddress(ip)).toBe(false));
});

describe("fetchUrl", () => {
  let server: http.Server;
  let base: string;

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      if (req.url === "/ok") {
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        res.end("<html><body>hola receta</body></html>");
      } else if (req.url === "/redirect") {
        res.writeHead(302, { location: "/ok" });
        res.end();
      } else if (req.url === "/loop") {
        res.writeHead(302, { location: "/loop" });
        res.end();
      } else if (req.url === "/big") {
        res.writeHead(200, { "content-type": "text/html" });
        res.end("x".repeat(2000));
      } else if (req.url === "/slow") {
        // no responde
      } else if (req.url === "/img") {
        res.writeHead(200, { "content-type": "image/png" });
        res.end("png");
      } else {
        res.writeHead(404);
        res.end();
      }
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(() => {
    server.closeAllConnections();
    server.close();
  });

  it("bloquea direcciones privadas por defecto (SSRF)", async () => {
    for (const url of [
      base + "/ok",
      "http://localhost/x",
      "http://169.254.169.254/latest/meta-data",
      "http://[::1]/",
    ]) {
      const res = await fetchUrl(url);
      expect(res.ok).toBe(false);
    }
  });

  it("solo acepta http y https", async () => {
    expect(await fetchUrl("file:///etc/passwd")).toMatchObject({ ok: false });
    expect(await fetchUrl("ftp://ejemplo.com")).toMatchObject({ ok: false });
    expect(await fetchUrl("esto no es un link")).toMatchObject({ ok: false });
  });

  it("descarga el HTML y sigue redirecciones", async () => {
    const direct = await fetchUrl(base + "/ok", { allowPrivate: true });
    expect(direct).toMatchObject({ ok: true });
    const redirected = await fetchUrl(base + "/redirect", { allowPrivate: true });
    expect(redirected).toMatchObject({ ok: true, finalUrl: base + "/ok" });
    if (redirected.ok) expect(redirected.html).toContain("hola receta");
  });

  it("corta los loops de redirección, los errores HTTP, lo que no es HTML y lo muy grande", async () => {
    expect(await fetchUrl(base + "/loop", { allowPrivate: true })).toMatchObject({ ok: false });
    expect(await fetchUrl(base + "/nada", { allowPrivate: true })).toMatchObject({ ok: false });
    expect(await fetchUrl(base + "/img", { allowPrivate: true })).toMatchObject({ ok: false });
    expect(await fetchUrl(base + "/big", { allowPrivate: true, maxBytes: 1000 })).toMatchObject({
      ok: false,
      error: expect.stringContaining("grande"),
    });
  });

  it("corta por timeout", async () => {
    const res = await fetchUrl(base + "/slow", { allowPrivate: true, timeoutMs: 300 });
    expect(res).toMatchObject({ ok: false, error: expect.stringContaining("tardó") });
  });
});
