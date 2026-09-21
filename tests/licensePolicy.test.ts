import { describe, expect, test } from "bun:test";
import { canUseOfflineLicense, GRACE_DAYS } from "../src/lib/licensePolicy";

const now = Date.parse("2026-09-05T12:00:00Z");
const valid = { status: "ok" as const, checked_at: "2026-09-04T12:00:00Z", expires_at: "2026-10-01T00:00:00Z" };

describe("ativação e carência offline", () => {
  test("primeira instalação não é liberada sem ativação", () => {
    expect(canUseOfflineLicense(null, now)).toBe(false);
  });
  test("ativação válida permite usar o PDV durante a carência", () => {
    expect(canUseOfflineLicense(valid, now)).toBe(true);
  });
  test("licença vencida bloqueia mesmo com verificação recente", () => {
    expect(canUseOfflineLicense({ ...valid, expires_at: "2026-09-05T12:00:00Z" }, now)).toBe(false);
  });
  test("carência vencida bloqueia licença sem prazo de vencimento", () => {
    expect(canUseOfflineLicense({ ...valid, expires_at: null }, now + GRACE_DAYS * 86400000)).toBe(false);
  });
  test("relógio anterior à verificação não estende a carência", () => {
    expect(canUseOfflineLicense(valid, Date.parse("2026-09-03T12:00:00Z"))).toBe(false);
  });
  test("datas inválidas não liberam acesso", () => {
    expect(canUseOfflineLicense({ ...valid, checked_at: "inválida" }, now)).toBe(false);
    expect(canUseOfflineLicense({ ...valid, expires_at: "inválida" }, now)).toBe(false);
  });
  test("cache de licença revogada não libera o PDV", () => {
    expect(canUseOfflineLicense({ ...valid, status: "revoked" }, now)).toBe(false);
  });
});
