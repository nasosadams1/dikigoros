import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

const manualChunks = (id: string) => {
  if (!id.includes("node_modules")) return undefined;
  const normalizedId = id.replace(/\\/g, "/");

  if (
    normalizedId.includes("/react/") ||
    normalizedId.includes("/react-dom/") ||
    normalizedId.includes("/react-router-dom/") ||
    normalizedId.includes("/@tanstack/")
  ) {
    return "vendor-react";
  }

  if (normalizedId.includes("/@supabase/")) return "vendor-supabase";
  if (normalizedId.includes("/@radix-ui/") || normalizedId.includes("/cmdk/") || normalizedId.includes("/vaul/")) return "vendor-ui";
  if (normalizedId.includes("/lucide-react/")) return "vendor-icons";
  if (normalizedId.includes("/date-fns/") || normalizedId.includes("/recharts/")) return "vendor-analytics";

  return undefined;
};

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
  test: {
    environment: "jsdom",
    exclude: ["tests/e2e/**", "node_modules/**", "dist/**"],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks,
      },
    },
  },
}));
