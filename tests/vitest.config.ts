/** Config isolada: o vite.config.ts da raiz fixa `root: client` (front-end). */
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const aqui = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    root: resolve(aqui, ".."),
    include: ["tests/**/*.test.ts"],
  },
});
