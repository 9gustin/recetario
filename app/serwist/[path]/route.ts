import { createSerwistRoute } from "@serwist/turbopack";

// Versiona la página offline precacheada: en Vercel viene el SHA del commit.
const revision = process.env.VERCEL_GIT_COMMIT_SHA ?? crypto.randomUUID();

export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } = createSerwistRoute(
  {
    additionalPrecacheEntries: [{ url: "/offline", revision }],
    swSrc: "app/sw.ts",
    useNativeEsbuild: true,
  },
);
