import type { LicenseCache } from "../types";

export const GRACE_DAYS = 15;

export function canUseOfflineLicense(cache: LicenseCache | null, now = Date.now()): boolean {
  if (cache?.status !== "ok" || !cache.checked_at) return false;
  const checkedAt = Date.parse(cache.checked_at);
  const age = now - checkedAt;
  if (!Number.isFinite(age) || age < 0 || age > GRACE_DAYS * 86400000) return false;
  if (cache.expires_at) {
    const expiresAt = Date.parse(cache.expires_at);
    if (!Number.isFinite(expiresAt) || now >= expiresAt) return false;
  }
  return true;
}
