import type { MetadataRoute } from "next";

const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/explorar", "/receta/", "/coleccion/", "/plan-publico/"],
        disallow: ["/g/", "/perfil", "/grupos", "/api/", "/r/", "/join/"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
