import { afterEach, expect, test } from "bun:test";
import config from "../vite.config";

const previousUrl = process.env.VITE_SUPABASE_URL;
const previousKey = process.env.VITE_SUPABASE_ANON_KEY;

afterEach(() => {
  if (previousUrl === undefined) delete process.env.VITE_SUPABASE_URL;
  else process.env.VITE_SUPABASE_URL = previousUrl;
  if (previousKey === undefined) delete process.env.VITE_SUPABASE_ANON_KEY;
  else process.env.VITE_SUPABASE_ANON_KEY = previousKey;
});

test("não gera instalador sem URL do serviço de ativação", () => {
  process.env.VITE_SUPABASE_URL = "";
  process.env.VITE_SUPABASE_ANON_KEY = "chave-publica-de-teste";
  expect(() => config({ command: "build", mode: "production" })).toThrow("Build bloqueado");
});

test("não gera instalador sem chave pública do serviço de ativação", () => {
  process.env.VITE_SUPABASE_URL = "https://example.supabase.co";
  process.env.VITE_SUPABASE_ANON_KEY = " ";
  expect(() => config({ command: "build", mode: "production" })).toThrow("Build bloqueado");
});

test("permite compilar quando o serviço de ativação está configurado", () => {
  process.env.VITE_SUPABASE_URL = "https://example.supabase.co";
  process.env.VITE_SUPABASE_ANON_KEY = "chave-publica-de-teste";
  expect(() => config({ command: "build", mode: "production" })).not.toThrow();
});
