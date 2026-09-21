import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

// O Simplifica Oficina usa um canal de atualização próprio e separado do PDV.
const UPDATER_ENABLED = import.meta.env.VITE_UPDATER_ENABLED !== "false";

export type UpdateStatus =
  | { state: "idle" }
  | { state: "checking" }
  | { state: "up-to-date" }
  | { state: "available"; version: string; notes?: string }
  | { state: "downloading"; progress: number }
  | { state: "error"; message: string };

// Verifica se há uma nova versão publicada no latest.json remoto.
// O Tauri confere a assinatura (pubkey configurada no tauri.conf.json)
// antes de aceitar qualquer atualização.
export async function checkForUpdate(
  onStatus: (s: UpdateStatus) => void
) {
  if (!UPDATER_ENABLED) {
    onStatus({
      state: "error",
      message: "A verificação de atualizações está desativada nesta instalação.",
    });
    return;
  }
  try {
    onStatus({ state: "checking" });
    const update = await check();

    if (!update) {
      onStatus({ state: "up-to-date" });
      return;
    }

    onStatus({
      state: "available",
      version: update.version,
      notes: update.body ?? undefined,
    });

    let downloaded = 0;
    let contentLength = 0;

    await update.downloadAndInstall((event) => {
      switch (event.event) {
        case "Started":
          contentLength = event.data.contentLength ?? 0;
          break;
        case "Progress":
          downloaded += event.data.chunkLength;
          const progress = contentLength
            ? Math.round((downloaded / contentLength) * 100)
            : 0;
          onStatus({ state: "downloading", progress });
          break;
        case "Finished":
          break;
      }
    });

    // Após instalar, reinicia o app já na nova versão
    await relaunch();
  } catch (err) {
    onStatus({ state: "error", message: String(err) });
  }
}
