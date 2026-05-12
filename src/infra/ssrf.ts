import { promises as dns } from "node:dns";
import { isIP } from "node:net";

const V4_PRIVATE_RANGES: Array<[number, number]> = [
  [ipToInt("10.0.0.0"), ipToInt("10.255.255.255")],
  [ipToInt("172.16.0.0"), ipToInt("172.31.255.255")],
  [ipToInt("192.168.0.0"), ipToInt("192.168.255.255")],
  [ipToInt("127.0.0.0"), ipToInt("127.255.255.255")],
  [ipToInt("169.254.0.0"), ipToInt("169.254.255.255")],
  [ipToInt("0.0.0.0"), ipToInt("0.255.255.255")],
];

function ipToInt(ip: string): number {
  const parts = ip.split(".").map(Number);
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

export function isPrivateIp(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) {
    const n = ipToInt(ip);
    return V4_PRIVATE_RANGES.some(([lo, hi]) => n >= lo && n <= hi);
  }
  if (version === 6) {
    const norm = ip.toLowerCase();
    if (norm === "::1" || norm === "::") return true;
    if (norm.startsWith("fc") || norm.startsWith("fd")) return true; // unique-local fc00::/7
    if (norm.startsWith("fe80:")) return true; // link-local
    if (norm.startsWith("::ffff:")) {
      const v4 = norm.slice("::ffff:".length);
      if (isIP(v4) === 4) return isPrivateIp(v4);
    }
    return false;
  }
  return false;
}

export async function assertSafeUrl(raw: string): Promise<void> {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new Error("Invalid URL");
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new Error(`Disallowed scheme: ${u.protocol}`);
  }
  if (u.hostname === "localhost") throw new Error("Disallowed host: localhost");
  if (isIP(u.hostname)) {
    if (isPrivateIp(u.hostname)) throw new Error(`Disallowed IP: ${u.hostname}`);
    return;
  }
  const resolved = await dns.lookup(u.hostname, { all: true });
  for (const r of resolved) {
    if (isPrivateIp(r.address)) {
      throw new Error(`Host ${u.hostname} resolves to private IP ${r.address}`);
    }
  }
}
