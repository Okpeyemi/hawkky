import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;

function getKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex || !/^[0-9a-f]{64}$/.test(hex)) {
    throw new Error("ENCRYPTION_KEY missing or invalid (must be 32 bytes hex)");
  }
  return Buffer.from(hex, "hex");
}

/** Encrypt plaintext UTF-8 → base64 string `iv|tag|ciphertext`. */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

/** Decrypt a base64 blob produced by `encrypt()`. Throws on tampering or malformed input. */
export function decrypt(blob: string): string {
  const buf = Buffer.from(blob, "base64");
  if (buf.length < IV_LEN + TAG_LEN + 1) {
    throw new Error("ciphertext too short");
  }
  const key = getKey();
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const enc = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}
