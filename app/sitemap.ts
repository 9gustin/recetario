import type { MetadataRoute } from "next";
import { listPublicSlugs } from "@/lib/public/queries";

const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const PATH: Record<string, string> = {
  receta: "receta",
  coleccion: "coleccion",
  plan: "plan-publico",
};

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const slugs = await listPublicSlugs();
  return [
    { url: `${base}/explorar`, changeFrequency: "daily" },
    ...slugs.map((s) => ({
      url: `${base}/${PATH[s.kind]}/${s.slug}`,
      lastModified: new Date(s.updated),
    })),
  ];
}
