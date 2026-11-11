import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const alias = { "@": fileURLToPath(new URL("./", import.meta.url)) };
const exclude = ["node_modules/**", ".next/**", "tests/e2e/**"];

export default defineConfig({
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: "node",
          environment: "node",
          include: ["**/*.test.{ts,tsx}"],
          exclude: [...exclude, "**/*.dom.test.tsx"],
        },
      },
      {
        // Tests de componentes: archivos *.dom.test.tsx corren en jsdom.
        resolve: { alias },
        test: {
          name: "dom",
          environment: "jsdom",
          include: ["**/*.dom.test.tsx"],
          exclude,
        },
      },
    ],
  },
});
