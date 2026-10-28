import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    // RLS testovi traže lokalni Supabase; pokreću se zasebno (npm run test:rls).
    exclude: ["tests/rls/**", "node_modules/**"],
  },
});
