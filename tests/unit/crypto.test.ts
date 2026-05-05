import { beforeAll, describe, expect, it } from "vitest";
import { decrypt, encrypt } from "@/src/infra/crypto";

beforeAll(() => {
  // Clé test 32 bytes (64 hex chars) — DOIT être dans process.env avant import du module
  process.env.ENCRYPTION_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
});

describe("crypto AES-256-GCM", () => {
  it("round-trips a string", () => {
    const plain = "ghp_super_secret_token_12345";
    const cipher = encrypt(plain);
    expect(cipher).not.toContain(plain);
    expect(decrypt(cipher)).toBe(plain);
  });

  it("produces different ciphertexts for the same input (random IV)", () => {
    const a = encrypt("same");
    const b = encrypt("same");
    expect(a).not.toBe(b);
    expect(decrypt(a)).toBe("same");
    expect(decrypt(b)).toBe("same");
  });

  it("detects tampering (auth tag mismatch)", () => {
    const cipher = encrypt("payload");
    // Modifier 1 char au milieu
    const tampered = cipher.slice(0, 30) + (cipher[30] === "a" ? "b" : "a") + cipher.slice(31);
    expect(() => decrypt(tampered)).toThrow();
  });

  it("rejects malformed input", () => {
    expect(() => decrypt("not-base64-and-too-short")).toThrow();
  });
});
