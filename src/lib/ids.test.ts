import { describe, expect, it } from "vitest";
import { newId } from "./ids";

describe("UUID v7 standardı (şema Karar 6)", () => {
  it("geçerli UUID v7 üretir (version niblesi 7)", () => {
    const id = newId();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it("zaman sıralıdır (v7 özelliği — index lokalitesi)", () => {
    const ids = Array.from({ length: 50 }, () => newId());
    const sorted = [...ids].sort();
    expect(ids).toEqual(sorted);
  });

  it("benzersizdir", () => {
    const ids = new Set(Array.from({ length: 1000 }, () => newId()));
    expect(ids.size).toBe(1000);
  });
});
