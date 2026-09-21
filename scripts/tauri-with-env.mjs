import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const environment = { ...process.env };
const privateKeyPath = environment.TAURI_SIGNING_PRIVATE_KEY_PATH?.trim();

if (!environment.TAURI_SIGNING_PRIVATE_KEY && privateKeyPath) {
  environment.TAURI_SIGNING_PRIVATE_KEY = readFileSync(privateKeyPath, "utf8").trim();
}

const cliPath = fileURLToPath(
  new URL("../node_modules/@tauri-apps/cli/tauri.js", import.meta.url),
);
const result = spawnSync(
  process.execPath,
  [cliPath, ...process.argv.slice(2)],
  { env: environment, stdio: "inherit" },
);

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
