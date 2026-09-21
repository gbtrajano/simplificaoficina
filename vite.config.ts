import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// Config padrão recomendada pelo Tauri para dev com HMR
export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  if (command === "build" && (!env.VITE_SUPABASE_URL?.trim() || !env.VITE_SUPABASE_ANON_KEY?.trim())) {
    throw new Error("Build bloqueado: configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no .env.local para exigir ativação por licença.");
  }
  return {
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
  // As variáveis de assinatura TAURI_SIGNING_* não pertencem ao frontend.
  envPrefix: ["VITE_"],
  // ES2018 cobre desde WebViews/Chrome/Safari antigos — importante porque a
  // MESMA build é servida ao celular dos garçons (que costuma ser um aparelho
  // simples), não só ao WebView2 do desktop.
  build: {
    target: "es2018",
    minify: !process.env.TAURI_ENV_DEBUG ? "esbuild" : false,
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
  },
  };
});
